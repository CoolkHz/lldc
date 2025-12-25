function randomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % maxExclusive
}

export function randomTicketNumber(): string {
  const n = randomInt(10000)
  return String(n).padStart(4, "0")
}

export function randomOutTradeNo(prefix?: string): string {
  const buf = new Uint32Array(4)
  crypto.getRandomValues(buf)
  const rand = Array.from(buf)
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("")
  const ts = Date.now().toString(36)
  return `${prefix ?? "ord"}_${ts}_${rand}`
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function winningFromDigestHex(digestHex: string): string {
  const first8 = digestHex.slice(0, 8)
  const value = Number.parseInt(first8, 16)
  const n = value % 10000
  return String(n).padStart(4, "0")
}

