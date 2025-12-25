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

  // 强制先抢锁：open -> closing；失败则返回 closing/drawn（幂等）
  const lockResult = await setClosingIfOpen(params.db, drawId)
  const locked = (lockResult as unknown as { changes?: number }).changes === 1
  if (!locked) {
    const current = await getDrawById(params.db, drawId)
    if (!current) throw new HttpError(500, `draw 不存在：${drawId}`)

    if (current.status === "drawn" && current.winning) {
      return { drawId, status: "already_drawn" as const, winning: current.winning }
    }

    return { drawId, status: "closing" as const }
  }

  let txResult:
    | { drawId: string; status: "ok"; winning: string }
    | { drawId: string; status: "race_lost" }

  try {
    txResult = await params.db.transaction(async (tx) => {
      const latest = await getDrawById(tx as unknown as DbClient, drawId)
      if (!latest) throw new HttpError(500, `draw 不存在：${drawId}`)
      if (latest.status !== "closing") return { drawId, status: "race_lost" as const }

      const prevDrawId = getPrevDrawId(drawId)
      const prevDraw = await getDrawById(tx as unknown as DbClient, prevDrawId)
      const carryOverPoints = prevDraw?.carryOverPoints ?? 0

      const paidPoints = await sumPaidPointsByDraw(tx as unknown as DbClient, drawId)
      const pool = calculatePool({ paidPoints, carryOverPoints, linuxdoFeeRate: params.config.linuxdoFeeRate })

      const ticketRows = await (tx as unknown as DbClient)
        .select({
          id: tickets.id,
          number: tickets.number,
          outTradeNo: tickets.outTradeNo,
          linuxdoUserId: tickets.linuxdoUserId,
        })
        .from(tickets)
        .where(eq(tickets.drawId, drawId))
        .orderBy(asc(tickets.id))
        .all()

      const ticketMaterial = ticketRows.map((t) => `${t.id}:${t.number}`).join("|")
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

      const winnerCounts = {
        p1: tiers.filter((t) => t.tier === 1).length,
        p2: tiers.filter((t) => t.tier === 2).length,
        p3: tiers.filter((t) => t.tier === 3).length,
      }
      const tierPayout = calculateTierPayouts({
        pools: { p1: pool.p1Points, p2: pool.p2Points, p3: pool.p3Points },
        winnerCounts,
      })

      // 先清空（防止中途失败重试导致残留），再按 tier 写入固定 per 值。
      await (tx as unknown as DbClient)
        .update(tickets)
        .set({ prizeTier: 0, payoutPoints: 0 })
        .where(eq(tickets.drawId, drawId))

      if (tierPayout.p1.perPoints > 0) {
        await (tx as unknown as DbClient)
          .update(tickets)
          .set({ prizeTier: 1, payoutPoints: tierPayout.p1.perPoints })
          .where(sql`${tickets.drawId} = ${drawId} AND ${tickets.number} = ${winning}`)
      }
      if (tierPayout.p2.perPoints > 0) {
        await (tx as unknown as DbClient)
          .update(tickets)
          .set({ prizeTier: 2, payoutPoints: tierPayout.p2.perPoints })
          .where(
            sql`${tickets.drawId} = ${drawId} AND substr(${tickets.number}, 2) = substr(${winning}, 2) AND ${tickets.number} != ${winning}`,
          )
      }
      if (tierPayout.p3.perPoints > 0) {
        await (tx as unknown as DbClient)
          .update(tickets)
          .set({ prizeTier: 3, payoutPoints: tierPayout.p3.perPoints })
          .where(
            sql`${tickets.drawId} = ${drawId} AND substr(${tickets.number}, 3) = substr(${winning}, 3) AND substr(${tickets.number}, 2) != substr(${winning}, 2)`,
          )
      }

      // 插入 payouts（pending）
      const payoutRows = tiers
        .map((t) => {
          const amountPoints =
            t.tier === 1 ? tierPayout.p1.perPoints : t.tier === 2 ? tierPayout.p2.perPoints : t.tier === 3 ? tierPayout.p3.perPoints : 0
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
      await insertPayouts(tx as unknown as DbClient, payoutRows)

      // 回填 orders.bonus_points：单条 SQL 聚合，避免 JS N+1。
      await (tx as unknown as DbClient).run(
        sql`UPDATE ${orders}
            SET ${orders.bonusPoints} = (
              SELECT coalesce(sum(${tickets.payoutPoints}), 0)
              FROM ${tickets}
              WHERE ${tickets.outTradeNo} = ${orders.outTradeNo}
            )
            WHERE ${orders.drawId} = ${drawId}`,
      )

      // 更新 draws：closing -> drawn；seed_reveal=seed_pending；seed_pending=''；carry_over_points=nextCarryOver
      const drawUpdate = await (tx as unknown as DbClient)
        .update(draws)
        .set({
          status: "drawn",
          winning,
          ticketsHash,
          seedReveal,
          seedPending: "",

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

      const finalized = (drawUpdate as unknown as { changes?: number }).changes === 1
      if (!finalized) return { drawId, status: "race_lost" as const }

      await addAuditEvent(tx as unknown as DbClient, {
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

      return { drawId, status: "ok" as const, winning }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await addAuditEvent(params.db, { type: "draw.run_error", refId: drawId, payload: { drawId, message } })
    } catch {
      // ignore
    }
    throw error
  }

  if (txResult.status === "ok") {
    // KV 操作必须在事务提交后执行，避免回滚导致脏读。
    await invalidateLotteryCaches(params.kv, params.config, drawId)
    const latest = await getDrawById(params.db, drawId)
    const counts = await params.db
      .select({
        tier: tickets.prizeTier,
        count: sql<number>`count(*)`,
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

    // 预热下一期（避免第一单创建时再创建 draw）。
    await ensureDraw(params.db, getNextDrawId(drawId))
  }

  return txResult
}

export async function invalidateLotteryCaches(kv: KVNamespace, config: AppConfig, drawId: string) {
  await Promise.all([
    del(kv, dashboardKey(config.cacheVersion, drawId)),
    del(kv, poolKey(config.cacheVersion, drawId)),
    // 仅清理本服务默认分页组合；其它组合依赖 TTL 或 CACHE_VERSION 切换。
    del(kv, participantsKey(config.cacheVersion, drawId, 50, 0)),
    del(kv, drawsListKey(config.cacheVersion, 20, 0)),
  ])
}

export { ensureDraw }
