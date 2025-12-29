import { asc, eq, sql } from "drizzle-orm"

import { HttpError } from "@/lib/errors/http"
import { del, dashboardKey, drawDetailKey, drawsListKey, participantsKey, poolKey, setJson } from "@/lib/cache/kv"
import { calculatePool, calculateTierPayouts, getPrizeTier } from "@/lib/lottery/calc"
import { sha256Hex, winningFromDigestHex } from "@/lib/lottery/random"
import { getDueDrawId, getNextDrawId, getPrevDrawId, getSalesWindowUtcSeconds } from "@/lib/lottery/time"
import type { AppConfig } from "@/lib/env"
import type { DbClient } from "@/lib/db/client"
import { addAuditEvent } from "@/repositories/audit.repo"
import { createDrawIfNotExists, getDrawById, setClosingIfOpen } from "@/repositories/draws.repo"
import { sumPaidPointsByDraw } from "@/repositories/orders.repo"
import { insertPayouts } from "@/repositories/payouts.repo"
import { draws, orders, tickets } from "@/db/schema"

function getD1Changes(result: unknown): number | undefined {
  if (!result || typeof result !== "object") return undefined
  const r = result as { changes?: unknown; meta?: unknown }
  if (typeof r.changes === "number") return r.changes
  const meta = r.meta as { changes?: unknown } | undefined
  if (meta && typeof meta === "object" && typeof meta.changes === "number") return meta.changes
  return undefined
}

async function ensureDraw(db: DbClient, drawId: string) {
  const existing = await getDrawById(db, drawId)
  if (existing) return existing

  const { salesStartTs, salesEndTs } = getSalesWindowUtcSeconds(drawId)
  const seedPending = `seed_${drawId}_${crypto.randomUUID()}`
  const seedHash = await sha256Hex(seedPending)
  const created = await createDrawIfNotExists(db, { drawId, salesStartTs, salesEndTs, seedHash, seedPending })
  if (!created) throw new HttpError(500, `创建 draw 失败：${drawId}`)
  return created
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000)
}

export async function runDraw(params: { db: DbClient; kv: KVNamespace; config: AppConfig; drawId?: string }) {
  const drawId = params.drawId ?? getDueDrawId()
  const draw = await ensureDraw(params.db, drawId)

  const now = nowUnixSeconds()
  if (now <= draw.salesEndTs) {
    throw new HttpError(400, `销售尚未结束（sales_end_ts=${draw.salesEndTs}）`)
  }

  let result: { drawId: string; status: "ok"; winning: string } | null = null

  try {
    const lockResult = await setClosingIfOpen(params.db, drawId)
    const locked = getD1Changes(lockResult) === 1

    let current = await getDrawById(params.db, drawId)
    if (!current) throw new HttpError(500, `draw 不存在：${drawId}`)

    // 极端情况下（changes 判定不兼容）可能出现 locked=false 且 status=open；再尝试一次以避免误判导致无法推进。
    if (!locked && current.status === "open") {
      const lockResult2 = await setClosingIfOpen(params.db, drawId)
      current = await getDrawById(params.db, drawId)
      if (!current) throw new HttpError(500, `draw 不存在：${drawId}`)
      if (getD1Changes(lockResult2) !== 1 && current.status === "open") {
        throw new HttpError(409, "开奖抢锁失败")
      }
    }

    if (current.status === "drawn" && current.winning) {
      return { drawId, status: "already_drawn" as const, winning: current.winning }
    }

    // 允许接管：status=closing 且未写入 winning 时，后续调用继续完成开奖。
    if (current.status !== "closing") {
      return { drawId, status: "closing" as const }
    }

    const latest = await getDrawById(params.db, drawId)
    if (!latest) throw new HttpError(500, `draw 不存在：${drawId}`)
    if (latest.status === "drawn" && latest.winning) {
      return { drawId, status: "already_drawn" as const, winning: latest.winning }
    }
    if (latest.status !== "closing") {
      return { drawId, status: "race_lost" as const }
    }

    const prevDrawId = getPrevDrawId(drawId)
    const prevDraw = await getDrawById(params.db, prevDrawId)
    const carryOverPoints = prevDraw?.carryOverPoints ?? 0

    const paidPoints = await sumPaidPointsByDraw(params.db, drawId)
    const pool = calculatePool({ paidPoints, carryOverPoints, linuxdoFeeRate: params.config.linuxdoFeeRate })

    const ticketRows = await params.db
      .select({
        id: tickets.id,
        number: tickets.number,
        ticketCount: tickets.ticketCount,
        outTradeNo: tickets.outTradeNo,
        linuxdoUserId: tickets.linuxdoUserId,
      })
      .from(tickets)
      .where(eq(tickets.drawId, drawId))
      .orderBy(asc(tickets.id))
      .all()

    const ticketMaterial = ticketRows.map((t) => `${t.id}:${t.number}:${t.ticketCount}`).join("|")
    const ticketsHash = await sha256Hex(ticketMaterial)

    const seedReveal = latest.seedPending
    if (!seedReveal) throw new HttpError(500, "seed_pending 缺失，无法 commit-reveal")
    if (latest.seedHash) {
      const verified = (await sha256Hex(seedReveal)) === latest.seedHash
      if (!verified) throw new HttpError(500, "seedReveal 与 seedHash 不匹配（commit-reveal 复核失败）")
    }

    const winning = winningFromDigestHex(await sha256Hex(`${drawId}|${seedReveal}|${ticketsHash}`))

    // 判奖：只取最高奖（1 > 2 > 3）
    const tiers = ticketRows.map((t) => ({
      ...t,
      tier: getPrizeTier(t.number, winning),
    }))

    const sumTierTicketCount = (tier: number) => tiers.reduce((sum, t) => (t.tier === tier ? sum + t.ticketCount : sum), 0)
    const winnerCounts = {
      p1: sumTierTicketCount(1),
      p2: sumTierTicketCount(2),
      p3: sumTierTicketCount(3),
    }
    const tierPayout = calculateTierPayouts({
      pools: { p1: pool.p1Points, p2: pool.p2Points, p3: pool.p3Points },
      winnerCounts,
    })

    // 先清空（防止中途失败重试导致残留），再按 tier 写入总奖金（per * ticketCount）。
    await params.db.update(tickets).set({ prizeTier: 0, payoutPoints: 0 }).where(eq(tickets.drawId, drawId))

    if (tierPayout.p1.perPoints > 0) {
      await params.db
        .update(tickets)
        .set({ prizeTier: 1, payoutPoints: sql<number>`${tierPayout.p1.perPoints} * ${tickets.ticketCount}` })
        .where(sql`${tickets.drawId} = ${drawId} AND ${tickets.number} = ${winning}`)
    }
    if (tierPayout.p2.perPoints > 0) {
      await params.db
        .update(tickets)
        .set({ prizeTier: 2, payoutPoints: sql<number>`${tierPayout.p2.perPoints} * ${tickets.ticketCount}` })
        .where(sql`${tickets.drawId} = ${drawId} AND substr(${tickets.number}, 2) = substr(${winning}, 2) AND ${tickets.number} != ${winning}`)
    }
    if (tierPayout.p3.perPoints > 0) {
      await params.db
        .update(tickets)
        .set({ prizeTier: 3, payoutPoints: sql<number>`${tierPayout.p3.perPoints} * ${tickets.ticketCount}` })
        .where(
          sql`${tickets.drawId} = ${drawId} AND substr(${tickets.number}, 3) = substr(${winning}, 3) AND substr(${tickets.number}, 2) != substr(${winning}, 2)`,
        )
    }

    // 插入 payouts（pending）
    const payoutRows = tiers
      .map((t) => {
        const perPoints =
          t.tier === 1
            ? tierPayout.p1.perPoints
            : t.tier === 2
              ? tierPayout.p2.perPoints
              : t.tier === 3
                ? tierPayout.p3.perPoints
                : 0
        const amountPoints = perPoints * t.ticketCount
        if (t.tier === 0 || amountPoints <= 0) return null
        return {
          drawId,
          ticketId: t.id,
          outTradeNo: t.outTradeNo,
          linuxdoUserId: t.linuxdoUserId,
          tier: t.tier,
          amountPoints,
          status: "pending",
        }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
    await insertPayouts(params.db, payoutRows)

    // 回填 orders.bonus_points：避免 D1/SQLite 不接受 SET 子句列名带表名前缀（"orders"."bonus_points"）。
    await params.db
      .update(orders)
      .set({
        bonusPoints: sql<number>`(
          SELECT coalesce(sum(${tickets.payoutPoints}), 0)
          FROM ${tickets}
          WHERE ${tickets.outTradeNo} = ${orders.outTradeNo}
        )`,
      })
      .where(eq(orders.drawId, drawId))

    // 更新 draws：closing -> drawn；seed_reveal=seed_pending；seed_pending=null；carry_over_points=nextCarryOver
    const drawUpdate = await params.db
      .update(draws)
      .set({
        status: "drawn",
        winning,
        ticketsHash,
        seedReveal,
        seedPending: null,

        grossPoints: pool.grossPoints,
        linuxdoFeePoints: pool.linuxdoFeePoints,
        netPoints: pool.netPoints,
        operatorFeePoints: pool.operatorFeePoints,
        p1Points: pool.p1Points,
        p2Points: pool.p2Points,
        p3Points: pool.p3Points,
        carryOverPoints: tierPayout.nextCarryOverPoints,
      })
      .where(sql`${draws.drawId} = ${drawId} AND ${draws.status} = 'closing'`)

    const finalized = getD1Changes(drawUpdate) === 1
    if (!finalized) {
      const current2 = await getDrawById(params.db, drawId)
      if (current2?.status === "drawn" && current2.winning) {
        return { drawId, status: "already_drawn" as const, winning: current2.winning }
      }
      return { drawId, status: "race_lost" as const }
    }

    await addAuditEvent(params.db, {
      type: "draw.drawn",
      refId: drawId,
      payload: {
        drawId,
        winning,
        ticketsHash,
        seedHash: latest.seedHash,
        seedReveal,
        paidPoints,
        carryOverPoints,
        pool,
        tierPayout,
      },
    })

    result = { drawId, status: "ok" as const, winning }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await addAuditEvent(params.db, { type: "draw.run_error", refId: drawId, payload: { drawId, message } })
    } catch {
      // ignore
    }
    throw error
  }

  if (!result) {
    return { drawId, status: "race_lost" as const }
  }

  if (result.status === "ok") {
    // KV 操作必须在事务提交后执行，避免回滚导致脏读。
    try {
      await invalidateLotteryCaches(params.kv, params.config, drawId)
      const latest = await getDrawById(params.db, drawId)
      const counts = await params.db
        .select({
          tier: tickets.prizeTier,
          count: sql<number>`coalesce(sum(${tickets.ticketCount}), 0)`,
        })
        .from(tickets)
        .where(eq(tickets.drawId, drawId))
        .groupBy(tickets.prizeTier)
        .all()
      const winnerCounts = Object.fromEntries(counts.map((c) => [String(c.tier), c.count]))
      await setJson(
        params.kv,
        drawDetailKey(params.config.cacheVersion, drawId),
        { draw: latest, winnerCounts },
        { ttlSeconds: params.config.cacheTtls.drawDetailSeconds },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[cache] draw post-commit cache update failed", { drawId, message })
    }

    // 预热下一期（避免第一单创建时再创建 draw）。
    try {
      await ensureDraw(params.db, getNextDrawId(drawId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[draw] prewarm next draw failed", { drawId, message })
    }
  }

  return result
}

export async function invalidateLotteryCaches(kv: KVNamespace, config: AppConfig, drawId: string) {
  const tasks = [
    del(kv, dashboardKey(config.cacheVersion, drawId)),
    del(kv, poolKey(config.cacheVersion, drawId)),
    // 仅清理本服务默认分页组合；其它组合依赖 TTL 或 CACHE_VERSION 切换。
    del(kv, participantsKey(config.cacheVersion, drawId, 50, 0)),
    del(kv, drawsListKey(config.cacheVersion, 20, 0)),
  ]
  const results = await Promise.allSettled(tasks)
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected")
  if (failures.length > 0) {
    console.error("[cache] invalidateLotteryCaches failed", {
      drawId,
      errors: failures.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))),
    })
  }
}

export { ensureDraw }
