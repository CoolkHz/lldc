import { and, desc, eq, isNull, sql } from "drizzle-orm"

import { draws } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

export type DrawStatus = "open" | "closing" | "drawn"

export async function getDrawById(db: DbClient, drawId: string) {
  const row = await db.select().from(draws).where(eq(draws.drawId, drawId)).get()
  return row ?? null
}

export async function createDrawIfNotExists(
  db: DbClient,
  params: {
    drawId: string
    salesStartTs: number
    salesEndTs: number
    seedHash: string
    seedPending: string
  },
) {
  await db
    .insert(draws)
    .values({
      drawId: params.drawId,
      status: "open",
      salesStartTs: params.salesStartTs,
      salesEndTs: params.salesEndTs,
      seedHash: params.seedHash,
      seedPending: params.seedPending,
      createdAt: sql`unixepoch()`,
    })
    .onConflictDoNothing()

  return await getDrawById(db, params.drawId)
}

export async function setClosingIfOpen(db: DbClient, drawId: string) {
  return await db
    .update(draws)
    .set({ status: "closing" })
    .where(and(eq(draws.drawId, drawId), eq(draws.status, "open")))
}

export async function finalizeDrawIfNotDrawn(
  db: DbClient,
  params: {
    drawId: string
    winning: string
    ticketsHash: string
    seedReveal: string
    grossPoints: number
    linuxdoFeePoints: number
    netPoints: number
    operatorFeePoints: number
    p1Points: number
    p2Points: number
    p3Points: number
    carryOverPoints: number
  },
) {
  return await db
    .update(draws)
    .set({
      status: "drawn",
      winning: params.winning,
      ticketsHash: params.ticketsHash,
      seedReveal: params.seedReveal,
      seedPending: null,

      grossPoints: params.grossPoints,
      linuxdoFeePoints: params.linuxdoFeePoints,
      netPoints: params.netPoints,
      operatorFeePoints: params.operatorFeePoints,
      p1Points: params.p1Points,
      p2Points: params.p2Points,
      p3Points: params.p3Points,
      carryOverPoints: params.carryOverPoints,
    })
    .where(
      and(
        eq(draws.drawId, params.drawId),
        isNull(draws.winning),
        eq(draws.status, "closing"),
      ),
    )
}

export async function listDraws(db: DbClient, params: { limit: number; offset: number }) {
  const rows = await db
    .select()
    .from(draws)
    .orderBy(desc(draws.drawId))
    .limit(params.limit)
    .offset(params.offset)
    .all()
  return rows
}

