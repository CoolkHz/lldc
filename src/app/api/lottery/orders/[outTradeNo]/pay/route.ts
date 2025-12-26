import { errorToResponse, html } from "@/app/api/_helpers"
import { requireUser } from "@/lib/auth/requireUser"
import { getEnv } from "@/lib/env"
import { HttpError } from "@/lib/errors/http"
import { buildEpayFields, renderAutoSubmitForm } from "@/lib/credit/epay"
import { getEffectiveOrderStatus } from "@/lib/lottery/order"
import { getOrderByOutTradeNo } from "@/repositories/orders.repo"

export async function POST(req: Request, ctx: { params: Promise<{ outTradeNo: string }> }) {
  try {
    const { db, config } = getEnv()
    const user = await requireUser(req)
    const { outTradeNo } = await ctx.params

    const now = Math.floor(Date.now() / 1000)

    const order = await getOrderByOutTradeNo(db, outTradeNo)
    if (!order) throw new HttpError(404, "订单不存在")
    if (order.linuxdoUserId !== user.linuxdoUserId) throw new HttpError(403, "无权限")
    const effectiveStatus = getEffectiveOrderStatus(order.status, order.createdAt, now)
    if (effectiveStatus !== "pending") throw new HttpError(400, "订单状态不可支付")

    const fields = buildEpayFields({
      pid: config.credit.pid,
      creditKey: config.credit.key,
      outTradeNo: order.outTradeNo,
      name: `lottery:${order.drawId}`,
      money: String(order.moneyPoints),
      notifyUrl: config.credit.notifyUrl,
      returnUrl: config.credit.returnUrl,
    })

    const payHtml = renderAutoSubmitForm({ actionUrl: config.credit.submitUrl, fields })
    return html(payHtml, { status: 200 })
  } catch (error) {
    return errorToResponse(error)
  }
}
