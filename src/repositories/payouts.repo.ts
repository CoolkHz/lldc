import { payouts } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

export async function insertPayouts(
  db: DbClient,
  rows: Array<{
    drawId: string
    ticketId: number
    outTradeNo: string
    linuxdoUserId: string
    tier: number
    amountPoints: number
    status: string
  }>,
) {
  if (rows.length === 0) return
  await db.insert(payouts).values(rows).onConflictDoNothing()
}

