import { and, desc, eq, inArray, sql } from "drizzle-orm"

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

export async function ensureTicketForOrder(
  db: DbClient,
  params: { drawId: string; outTradeNo: string; linuxdoUserId: string; number: string; ticketCount: number },
) {
  if (params.ticketCount <= 0) return { inserted: false }

  const result = await db.run(sql`
    INSERT INTO tickets (draw_id, out_trade_no, linuxdo_user_id, number, ticket_count)
    SELECT ${params.drawId}, ${params.outTradeNo}, ${params.linuxdoUserId}, ${params.number}, ${params.ticketCount}
    WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE out_trade_no = ${params.outTradeNo})
  `)

  const changes =
    typeof (result as unknown as { changes?: unknown }).changes === "number"
      ? ((result as unknown as { changes?: number }).changes ?? 0)
      : typeof (result as unknown as { meta?: unknown }).meta === "object" &&
          typeof ((result as unknown as { meta?: { changes?: unknown } }).meta?.changes) === "number"
        ? ((result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0)
        : 0

  return { inserted: changes === 1 }
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

