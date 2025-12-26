import { and, desc, eq, inArray } from "drizzle-orm"

import { tickets } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

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

