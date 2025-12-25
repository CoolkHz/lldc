import { and, desc, eq, sql } from "drizzle-orm"

import type { AppConfig } from "@/lib/env"
import type { DbClient } from "@/lib/db/client"
import { dashboardKey, del, drawDetailKey, drawsListKey, getJson, participantsKey, poolKey, setJson } from "@/lib/cache/kv"
import { calculatePool } from "@/lib/lottery/calc"
import { getCurrentDrawId, getPrevDrawId } from "@/lib/lottery/time"
import { HttpError } from "@/lib/errors/http"
import { draws, orders, tickets } from "@/db/schema"
import { getDrawById } from "@/repositories/draws.repo"
import { sumPaidPointsByDraw } from "@/repositories/orders.repo"
import { ensureDraw } from "@/services/draw.service"

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000)
}

export async function getDashboard(params: { db: DbClient; kv: KVNamespace; config: AppConfig; drawId?: string }) {
  const drawId = params.drawId ?? getCurrentDrawId()
  const dashboardCacheKey = dashboardKey(params.config.cacheVersion, drawId)
  const poolCacheKey = poolKey(params.config.cacheVersion, drawId)

  const cached = await getJson<unknown>(params.kv, dashboardCacheKey)
  if (cached) return cached

  await ensureDraw(params.db, drawId)
  const draw = await getDrawById(params.db, drawId)
  if (!draw) throw new HttpError(500, "draw 不存在")

  const prevCarryOver = (await getDrawById(params.db, getPrevDrawId(drawId)))?.carryOverPoints ?? 0
  const paidPoints = await sumPaidPointsByDraw(params.db, drawId)
  const pool = calculatePool({ paidPoints, carryOverPoints: prevCarryOver, linuxdoFeeRate: params.config.linuxdoFeeRate })

  const data = {
    drawId,
    nowTs: nowUnixSeconds(),
    draw,
    pool,
  }

  await Promise.all([
    setJson(params.kv, poolCacheKey, pool, { ttlSeconds: params.config.cacheTtls.poolSeconds }),
    setJson(params.kv, dashboardCacheKey, data, { ttlSeconds: params.config.cacheTtls.dashboardSeconds }),
  ])
  return data
}

export async function listDrawsCached(params: { db: DbClient; kv: KVNamespace; config: AppConfig; limit: number; cursor: number }) {
  // 缓存只覆盖最常用的第一页，便于在 notify/draw/run 时做明确失效（KV 不支持按前缀删除）。
  const canCache = params.limit === 20 && params.cursor === 0
  const key = drawsListKey(params.config.cacheVersion, params.limit, params.cursor)
  if (canCache) {
    const cached = await getJson<unknown>(params.kv, key)
    if (cached) return cached
  }

  const rows = await params.db
    .select()
    .from(draws)
    .orderBy(desc(draws.drawId))
    .limit(params.limit)
    .offset(params.cursor)
    .all()

  const data = {
    items: rows,
    limit: params.limit,
    cursor: params.cursor,
    nextCursor: rows.length === params.limit ? params.cursor + rows.length : null,
  }

  if (canCache) {
    await setJson(params.kv, key, data, { ttlSeconds: params.config.cacheTtls.drawsListSeconds })
  }
  return data
}

export async function getDrawDetailCached(params: { db: DbClient; kv: KVNamespace; config: AppConfig; drawId: string }) {
  const key = drawDetailKey(params.config.cacheVersion, params.drawId)
  const cached = await getJson<unknown>(params.kv, key)
  if (cached) return cached

  const draw = await getDrawById(params.db, params.drawId)
  if (!draw) throw new HttpError(404, "draw 不存在")

  const counts = await params.db
    .select({
      tier: tickets.prizeTier,
      count: sql<number>`count(*)`,
    })
    .from(tickets)
    .where(eq(tickets.drawId, params.drawId))
    .groupBy(tickets.prizeTier)
    .all()

  const data = {
    draw,
    winnerCounts: Object.fromEntries(counts.map((c) => [String(c.tier), c.count])),
  }

  await setJson(params.kv, key, data, { ttlSeconds: params.config.cacheTtls.drawDetailSeconds })
  return data
}

export async function listParticipantsCached(params: {
  db: DbClient
  kv: KVNamespace
  config: AppConfig
  drawId: string
  limit: number
  cursor: number
}) {
  // 缓存只覆盖最常用的第一页，便于在 notify/draw/run 时做明确失效（KV 不支持按前缀删除）。
  const canCache = params.limit === 50 && params.cursor === 0
  const key = participantsKey(params.config.cacheVersion, params.drawId, params.limit, params.cursor)
  if (canCache) {
    const cached = await getJson<unknown>(params.kv, key)
    if (cached) return cached
  }

  const rows = await params.db
    .select({
      linuxdoUserId: orders.linuxdoUserId,
      nickname: orders.userNicknameSnapshot,
      avatarUrl: orders.userAvatarSnapshot,
      ticketCount: sql<number>`sum(${orders.ticketCount})`,
    })
    .from(orders)
    .where(and(eq(orders.drawId, params.drawId), eq(orders.status, "paid")))
    .groupBy(orders.linuxdoUserId, orders.userNicknameSnapshot, orders.userAvatarSnapshot)
    .orderBy(desc(sql`ticketCount`))
    .limit(params.limit)
    .offset(params.cursor)
    .all()

  const data = {
    items: rows,
    limit: params.limit,
    cursor: params.cursor,
    nextCursor: rows.length === params.limit ? params.cursor + rows.length : null,
  }

  if (canCache) {
    await setJson(params.kv, key, data, { ttlSeconds: params.config.cacheTtls.participantsSeconds })
  }
  return data
}

export async function invalidateDrawDetail(kv: KVNamespace, config: AppConfig, drawId: string) {
  await Promise.all([del(kv, drawDetailKey(config.cacheVersion, drawId)), del(kv, drawsListKey(config.cacheVersion, 20, 0))])
}
