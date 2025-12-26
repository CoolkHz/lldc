import { signMd5Lower } from "@/lib/credit/sign"

type EpayFields = {
  pid: string
  type: "epay"
  out_trade_no: string
  name: string
  money: string
  notify_url?: string
  return_url?: string
  device?: string
  sign_type: "MD5"
  sign: string
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function normalizeMaybeEncodedUrl(input: string): string {
  const trimmed = input.trim()
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) return trimmed
  try {
    const decoded = decodeURIComponent(trimmed)
    if (/^https?:\/\//.test(decoded)) return decoded
  } catch {
    // ignore
  }
  return trimmed
}

function normalizeMoneyToFixed2(input: string): string {
  const n = Number(input)
  if (!Number.isFinite(n)) throw new Error(`Invalid money: ${input}`)
  // 平台端：Truncate(2).StringFixed(2)
  const truncated = Math.trunc(n * 100) / 100
  return truncated.toFixed(2)
}

export function buildEpayFields(params: {
  pid: string
  creditKey: string
  outTradeNo: string
  name: string
  money: string
  notifyUrl?: string
  returnUrl?: string
  device?: string
}): EpayFields {
  const notifyUrl = params.notifyUrl ? normalizeMaybeEncodedUrl(params.notifyUrl) : undefined
  const returnUrl = params.returnUrl ? normalizeMaybeEncodedUrl(params.returnUrl) : undefined
  const money = normalizeMoneyToFixed2(params.money)
  const baseFields = {
    pid: params.pid,
    type: "epay" as const,
    out_trade_no: params.outTradeNo,
    name: params.name,
    money,
    ...(notifyUrl ? { notify_url: notifyUrl } : {}),
    ...(returnUrl ? { return_url: returnUrl } : {}),
    ...(params.device ? { device: params.device } : {}),
  }

  const sign = signMd5Lower(baseFields, params.creditKey)
  return { ...baseFields, sign_type: "MD5", sign }
}

export function renderAutoSubmitForm(params: { actionUrl: string; fields: Record<string, string> }): string {
  const inputs = Object.entries(params.fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join("")
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting...</title>
  </head>
  <body>
    <form id="epay" method="post" action="${escapeHtml(params.actionUrl)}">${inputs}</form>
    <script>document.getElementById('epay').submit()</script>
  </body>
</html>`
}
