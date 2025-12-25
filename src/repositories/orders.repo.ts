import { and, desc, eq, isNull, sql } from "drizzle-orm"

import { orders } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

export type OrderStatus = "pending" | "paid"

export async function createOrder(
  db: DbClient,
  params: {
    outTradeNo: string
    drawId: string
    linuxdoUserId: string
    userNicknameSnapshot: string
    userAvatarSnapshot: string
    ticketCount: number
    unitPricePoints: number
    moneyPoints: number
    numbersJson: string
  },
) {
  await db.insert(orders).values({
    outTradeNo: params.outTradeNo,
    tradeNo: null,
    drawId: params.drawId,
    linuxdoUserId: params.linuxdoUserId,
    userNicknameSnapshot: params.userNicknameSnapshot,
    userAvatarSnapshot: params.userAvatarSnapshot,
    ticketCount: params.ticketCount,
    unitPricePoints: params.unitPricePoints,
    moneyPoints: params.moneyPoints,
    numbersJson: params.numbersJson,
    status: "pending",
    bonusPoints: 0,
    createdAt: sql`unixepoch()`,
    updatedAt: sql`unixepoch()`,
    paidAt: null,
  })

  return await getOrderByOutTradeNo(db, params.outTradeNo)
}

export async function getOrderByOutTradeNo(db: DbClient, outTradeNo: string) {
  const row = await db.select().from(orders).where(eq(orders.outTradeNo, outTradeNo)).get()
  return row ?? null
}

export async function markOrderPaidIfPending(
  db: DbClient,
  params: { outTradeNo: string; tradeNo: string; paidAtUnixSeconds: number },
) {
  return await db
    .update(orders)
    .set({
      status: "paid",
      tradeNo: params.tradeNo,
      paidAt: params.paidAtUnixSeconds,
      updatedAt: sql`unixepoch()`,
    })
    .where(
      and(
        eq(orders.outTradeNo, params.outTradeNo),
        eq(orders.status, "pending"),
        isNull(orders.paidAt),
      ),
    )
}

export async function sumPaidPointsByDraw(db: DbClient, drawId: string): Promise<number> {
  const row = await db
    .select({ sum: sql<number>`coalesce(sum(${orders.moneyPoints}), 0)` })
    .from(orders)
    .where(and(eq(orders.drawId, drawId), eq(orders.status, "paid")))
    .get()
  return row?.sum ?? 0
}

export async function listMyOrders(db: DbClient, params: { linuxdoUserId: string; limit: number; offset: number }) {
  return await db
    .select()
    .from(orders)
    .where(eq(orders.linuxdoUserId, params.linuxdoUserId))
    .orderBy(desc(orders.createdAt))
    .limit(params.limit)
    .offset(params.offset)
    .all()
}
