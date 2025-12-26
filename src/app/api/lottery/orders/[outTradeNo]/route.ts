import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { requireAuthContext } from "@/lib/auth/requireUser"
import { HttpError } from "@/lib/errors/http"
import { getEffectiveOrderStatus } from "@/lib/lottery/order"
import { getOrderByOutTradeNo } from "@/repositories/orders.repo"
import { listTicketsByOrder } from "@/repositories/tickets.repo"

export async function GET(req: Request, ctx: { params: Promise<{ outTradeNo: string }> }) {
  try {
    const { db } = getEnv()
    const { user, isAdmin } = await requireAuthContext(req)
    const { outTradeNo } = await ctx.params

    const order = await getOrderByOutTradeNo(db, outTradeNo)
    if (!order) throw new HttpError(404, "订单不存在")

    if (!isAdmin && order.linuxdoUserId !== user.linuxdoUserId) {
      throw new HttpError(403, "无权限")
    }

    const now = Math.floor(Date.now() / 1000)
    const effectiveStatus = getEffectiveOrderStatus(order.status, order.createdAt, now)
    const ticketList = effectiveStatus === "paid" ? await listTicketsByOrder(db, outTradeNo) : []
    return json({ order: { ...order, status: effectiveStatus }, tickets: ticketList })
  } catch (error) {
    return errorToResponse(error)
  }
}
