import SparkMD5 from "spark-md5"

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function toSigningEntries(params: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(params)
    .filter(([key]) => key !== "sign" && key !== "sign_type")
    .map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)] as [string, string])
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

export function buildMd5SigningString(params: Record<string, unknown>): string {
  return toSigningEntries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&")
}

export function signMd5Lower(params: Record<string, unknown>, secret: string): string {
  const base = buildMd5SigningString(params)
  return SparkMD5.hash(`${base}${secret}`).toLowerCase()
}

export function verifyMd5Lower(params: Record<string, unknown>, secret: string, expected: string): boolean {
  const computed = signMd5Lower(params, secret)
  return constantTimeEqual(computed, expected.toLowerCase())
}
