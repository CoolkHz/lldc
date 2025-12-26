import { HttpError } from "@/lib/errors/http"
import type { AppConfig } from "@/lib/env"
import type { DbClient } from "@/lib/db/client"
import { buildEpayFields, renderAutoSubmitForm } from "@/lib/credit/epay"
import { verifyMd5Lower } from "@/lib/credit/sign"
import { getCurrentDrawId } from "@/lib/lottery/time"
import { randomOutTradeNo } from "@/lib/lottery/random"
import { addAuditEvent } from "@/repositories/audit.repo"
import { createOrder, getOrderByOutTradeNo, markOrderPaidIfPending } from "@/repositories/orders.repo"
import { insertTicketForOrder } from "@/repositories/tickets.repo"
import { ensureDraw, invalidateLotteryCaches } from "@/services/draw.service"

const UNIT_PRICE_POINTS = 10
const MAX_TICKETS_PER_ORDER = 200

function parseTicketNumber(provided: unknown): string {
  if (typeof provided !== "string") throw new HttpError(400, "number 必须为字符串")
  const trimmed = provided.trim()
  if (!/^\d{4}$/.test(trimmed)) throw new HttpError(400, "number 必须为 4 位数字（0000-9999）")
  return trimmed
}

export async function createOrderAndRenderPayForm(params: {
  req: Request
  db: DbClient
  config: AppConfig
  user: { linuxdoUserId: string; nickname: string; avatarUrl: string }
  ticketCount: number
  number: unknown
}) {
  if (!Number.isInteger(params.ticketCount) || params.ticketCount <= 0) {
    throw new HttpError(400, "ticketCount 必须为正整数")
  }
  if (params.ticketCount > MAX_TICKETS_PER_ORDER) {
    throw new HttpError(400, `ticketCount 过大（最大 ${MAX_TICKETS_PER_ORDER}）`)
  }

  const drawId = getCurrentDrawId()
  await ensureDraw(params.db, drawId)

  const number = parseTicketNumber(params.number)
  const moneyPoints = params.ticketCount * UNIT_PRICE_POINTS
  const outTradeNo = randomOutTradeNo(`d${drawId.replaceAll("-", "")}`)

  const order = await createOrder(params.db, {
    outTradeNo,
    drawId,
    linuxdoUserId: params.user.linuxdoUserId,
    userNicknameSnapshot: params.user.nickname,
    userAvatarSnapshot: params.user.avatarUrl,
    ticketCount: params.ticketCount,
    unitPricePoints: UNIT_PRICE_POINTS,
    moneyPoints,
    number,
  })
  if (!order) throw new HttpError(500, "创建订单失败")

  await addAuditEvent(params.db, {
    type: "order.created",
    refId: outTradeNo,
    payload: { outTradeNo, drawId, ticketCount: params.ticketCount, moneyPoints },
  })

  const fields = buildEpayFields({
    pid: params.config.credit.pid,
    creditKey: params.config.credit.key,
    outTradeNo,
    name: `lottery:${drawId}`,
    money: String(moneyPoints),
    notifyUrl: params.config.credit.notifyUrl,
    returnUrl: params.config.credit.returnUrl,
  })

  const html = renderAutoSubmitForm({ actionUrl: params.config.credit.submitUrl, fields })
  return { order, html }
}

export async function handleCreditNotify(params: {
  req: Request
  db: DbClient
  kv: KVNamespace
  config: AppConfig
}) {
  const url = new URL(params.req.url)
  const qp = url.searchParams

  const payload: Record<string, string> = {}
  qp.forEach((value, key) => {
    payload[key] = value
  })

  const outTradeNo = payload.out_trade_no
  const tradeNo = payload.trade_no

  try {
    const pid = payload.pid
    const money = payload.money
    const tradeStatus = payload.trade_status
    const sign = payload.sign
    const signType = payload.sign_type

    if (!pid || !tradeNo || !outTradeNo || !money || !tradeStatus || !sign || !signType) {
      throw new HttpError(400, "回调参数缺失")
    }
    if (pid !== params.config.credit.pid) throw new HttpError(400, "pid 不匹配")
    if (signType !== "MD5") throw new HttpError(400, "sign_type 不支持")

    if (!verifyMd5Lower(payload, params.config.credit.key, sign)) {
      throw new HttpError(400, "签名校验失败")
    }

    if (tradeStatus !== "TRADE_SUCCESS") {
      await addAuditEvent(params.db, {
        type: "credit_notify_ignored",
        refId: outTradeNo ?? "unknown",
        payload: { out_trade_no: outTradeNo, trade_no: tradeNo, trade_status: tradeStatus, money },
      })
      return { outTradeNo, updated: false, ignored: true }
    }

    const paidAt = Math.floor(Date.now() / 1000)
    const result = await params.db.transaction(async (tx) => {
      const order = await getOrderByOutTradeNo(tx as unknown as DbClient, outTradeNo)
      if (!order) throw new HttpError(404, "订单不存在")

      const moneyInt = Number(money)
      if (!Number.isFinite(moneyInt) || moneyInt !== order.moneyPoints) {
        throw new HttpError(400, "money 与订单不一致")
      }

      // 幂等点：条件更新成功才插入 tickets；若更新行数=0（已 paid），必须直接返回且不重复插票。
      const updateResult = await markOrderPaidIfPending(tx as unknown as DbClient, {
        outTradeNo,
        tradeNo,
        paidAtUnixSeconds: paidAt,
      })
      const updated = (updateResult as unknown as { changes?: number }).changes === 1
      if (!updated) return { updated: false, drawId: order.drawId }

      if (!/^\d{4}$/.test(order.number)) throw new HttpError(500, "订单 number 异常")
      if (!Number.isInteger(order.ticketCount) || order.ticketCount <= 0) throw new HttpError(500, "订单 ticketCount 异常")

      await insertTicketForOrder(tx as unknown as DbClient, {
        drawId: order.drawId,
        outTradeNo,
        linuxdoUserId: order.linuxdoUserId,
        number: order.number,
        ticketCount: order.ticketCount,
      })

      await addAuditEvent(tx as unknown as DbClient, {
        type: "credit.notify_paid",
        refId: outTradeNo,
        payload: { outTradeNo, tradeNo, moneyPoints: order.moneyPoints },
      })

      return { updated: true, drawId: order.drawId }
    })

    if (result.updated) {
      await invalidateLotteryCaches(params.kv, params.config, result.drawId)
    }
    return { outTradeNo, updated: result.updated }
  } catch (error) {
    // 失败处理：避免对方重试风暴，仍返回 success；同时记录审计以便排查。
    const message = error instanceof Error ? error.message : String(error)
    try {
      await addAuditEvent(params.db, {
        type: "credit_notify_error",
        refId: outTradeNo ?? "unknown",
        payload: { out_trade_no: outTradeNo, trade_no: tradeNo, message },
      })
    } catch {
      // ignore
    }
    return { outTradeNo: outTradeNo ?? "unknown", updated: false, error: true }
  }
}
