import crypto from "node:crypto"

type Mode = "raw" | "decoded"

// 手动填写：应用密钥（CREDIT_KEY）
const SECRET = "0b3be773ad08c08c4e25ba9f531c0f749bbc5adb3ab9cc0efabf633b52bd18b7"

// 手动填写：完整查询串（可直接粘贴 pid=...&type=...&...&sign=...）
const QS = "pid=c5ff25e47d61cd03d46534d6bebcc2cdff1e4665743292a5842c7aa617020a1e&type=epay&out_trade_no=d20251227_mjmcngc1_693a845379c32ef4771096c066eb348e&name=lottery%3A2025-12-27&money=10&notify_url=https%3A%2F%2Flldc.llvi.de%2Fapi%2Fnotify&return_url=https%3A%2F%2Flldc.llvi.de%2Fapi%2Fcallback&sign_type=MD5&sign=d59cb4ac53fc4928e57a177615996b46"

function md5Lower(input: string) {
  return crypto.createHash("md5").update(input, "utf8").digest("hex").toLowerCase()
}

function parseRawQueryString(qs: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const s = qs.startsWith("?") ? qs.slice(1) : qs
  if (!s.trim()) return out
  for (const part of s.split("&")) {
    if (!part) continue
    const idx = part.indexOf("=")
    if (idx === -1) {
      out.push([part, ""])
      continue
    }
    const k = part.slice(0, idx)
    const v = part.slice(idx + 1)
    out.push([k, v])
  }
  return out
}

function decodeFormComponent(input: string): string {
  return decodeURIComponent(input.replace(/\+/g, " "))
}

function toSigningPairs(pairs: Array<[string, string]>, mode: Mode) {
  return pairs
    .filter(([k]) => k !== "sign" && k !== "sign_type")
    .map(([k, v]) => {
      const value = mode === "decoded" ? decodeFormComponent(v) : v
      return [k, value] as const
    })
    .filter(([, v]) => v !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

function buildSigningString(pairs: ReadonlyArray<readonly [string, string]>) {
  return pairs.map(([k, v]) => `${k}=${v}`).join("&")
}

function main() {
  const secret = SECRET.trim()
  const qs = QS.trim()

  if (!secret) {
    console.error("缺少 SECRET：请在 scripts/verify-epay-sign.ts 顶部手动填写 SECRET")
    process.exit(2)
  }
  if (!qs) {
    console.error("缺少 QS：请在 scripts/verify-epay-sign.ts 顶部手动填写 QS")
    process.exit(2)
  }

  const rawPairs = parseRawQueryString(qs)
  const expected = (rawPairs.find(([k]) => k === "sign")?.[1] ?? "").toLowerCase()

  for (const mode of ["raw", "decoded"] as const) {
    const signingPairs = toSigningPairs(rawPairs, mode)
    const base = buildSigningString(signingPairs)
    const computed = md5Lower(`${base}${secret}`)
    const ok = expected ? computed === expected : undefined

    console.log(`\n[mode=${mode}]`)
    console.log(`base=${base}`)
    console.log(`computed=${computed}`)
    if (expected) console.log(`expected=${expected}`)
    if (expected) console.log(`ok=${ok}`)
  }
}

main()
