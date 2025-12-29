import { and, desc, eq, inArray } from "drizzle-orm"

import { tickets } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

function getD1Changes(result: unknown): number | undefined {
  if (!result || typeof result !== "object") return undefined
  const r = result as { changes?: unknown; meta?: unknown }
  if (typeof r.changes === "number") return r.changes
  const meta = r.meta as { changes?: unknown } | undefined
  if (meta && typeof meta === "object" && typeof meta.changes === "number") return meta.changes
  return undefined
}

export async function insertTicketForOrder(
  db: DbClient,
  params: { drawId: string; outTradeNo: string; linuxdoUserId: string; number: string; ticketCount: number },
) {
  if (params.ticketCount <= 0) return
  await db.insert(tickets).values({
    drawId: params.drawId,
    outTradeNo: params.outTradeNo,
    linuxdoUserId: params.linuxdoUserId,
    number: params.number,
    ticketCount: params.ticketCount,
  })
}

export async function ensureTicketForOrder(
  db: DbClient,
  params: { drawId: string; outTradeNo: string; linuxdoUserId: string; number: string; ticketCount: number },
) {
  if (params.ticketCount <= 0) return { inserted: false }

  const result = await db
    .insert(tickets)
    .values({
      drawId: params.drawId,
      outTradeNo: params.outTradeNo,
      linuxdoUserId: params.linuxdoUserId,
      number: params.number,
      ticketCount: params.ticketCount,
    })
    .onConflictDoNothing()

  const inserted = getD1Changes(result) === 1
  return { inserted }
}

export async function listTicketsByOrder(db: DbClient, outTradeNo: string) {
  return await db.select().from(tickets).where(eq(tickets.outTradeNo, outTradeNo)).orderBy(desc(tickets.id)).all()
}

export async function listTicketsByDraw(db: DbClient, drawId: string) {
  return await db.select().from(tickets).where(eq(tickets.drawId, drawId)).orderBy(desc(tickets.id)).all()
}

export async function updateTicketPrizes(
  db: DbClient,
  params: { ticketIds: number[]; prizeTier: number; payoutPoints: number },
) {
  if (params.ticketIds.length === 0) return
  await db
    .update(tickets)
    .set({ prizeTier: params.prizeTier, payoutPoints: params.payoutPoints })
    .where(and(inArray(tickets.id, params.ticketIds), eq(tickets.payoutPoints, 0)))
}

