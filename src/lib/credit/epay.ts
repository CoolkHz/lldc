import { signMd5Lower } from "@/lib/credit/sign"

type EpayFields = {
  pid: string
  type: "epay"
  out_trade_no: string
  name: string
  money: string
  notify_url: string
  return_url: string
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

export function buildEpayFields(params: {
  pid: string
  creditKey: string
  outTradeNo: string
  name: string
  money: string
  notifyUrl: string
  returnUrl: string
}): EpayFields {
  const baseFields = {
    pid: params.pid,
    type: "epay" as const,
    out_trade_no: params.outTradeNo,
    name: params.name,
    money: params.money,
    notify_url: params.notifyUrl,
    return_url: params.returnUrl,
  }
  const sign = signMd5Lower(baseFields, params.creditKey)
  return { ...baseFields, sign_type: "MD5", sign }
}

export function renderAutoSubmitForm(params: { actionUrl: string; fields: Record<string, string> }): string {
  const inputs = Object.entries(params.fields)
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

