import { buildMd5SigningString, signMd5Lower } from "@/lib/credit/sign"

function readJsonFromArg(): Record<string, unknown> {
  const raw = process.argv[2]
  if (!raw) {
    throw new Error('Usage: pnpm tsx scripts/credit-md5-sign-check.ts \'{"pid":"...","out_trade_no":"..."}\'')
  }
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("payload must be a JSON object")
  return parsed as Record<string, unknown>
}

function main() {
  const payload = readJsonFromArg()
  const secret = process.env.CREDIT_KEY
  if (!secret) throw new Error("Missing CREDIT_KEY in env for this script")

  const signing = buildMd5SigningString(payload)
  const sign = signMd5Lower(payload, secret)

  console.log(signing)
  console.log(sign)
}

main()

