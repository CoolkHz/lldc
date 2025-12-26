import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { requireUser } from "@/lib/auth/requireUser"
import { getEffectiveOrderStatus } from "@/lib/lottery/order"
import { listMyOrders } from "@/repositories/orders.repo"

export async function GET(req: Request) {
  try {
    const { db } = getEnv()
    const user = await requireUser(req)
    const now = Math.floor(Date.now() / 1000)
    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100)
    const cursor = Math.max(Number(url.searchParams.get("cursor") ?? 0), 0)
    const items = await listMyOrders(db, { linuxdoUserId: user.linuxdoUserId, limit, offset: cursor })
    const normalized = items.map((o) => ({
      ...o,
      status: getEffectiveOrderStatus(o.status, o.createdAt, now),
    }))
    return json({ items: normalized, limit, cursor, nextCursor: items.length === limit ? cursor + items.length : null })
  } catch (error) {
    return errorToResponse(error)
  }
}
