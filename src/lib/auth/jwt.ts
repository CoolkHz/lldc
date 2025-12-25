import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE_NAME = "session"

const textEncoder = new TextEncoder()

export type SessionClaims = {
  sub: string
  exp?: number
  iat?: number
}

function getHs256Key(secret: string) {
  return textEncoder.encode(secret)
}

export async function signSessionToken(params: {
  userId: string
  secret: string
  expiresInSeconds?: number
}): Promise<string> {
  const expiresInSeconds = params.expiresInSeconds ?? 7 * 24 * 60 * 60
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getHs256Key(params.secret))
}

export async function verifySessionToken(params: {
  token: string
  secret: string
}): Promise<SessionClaims> {
  const { payload } = await jwtVerify(params.token, getHs256Key(params.secret), {
    algorithms: ["HS256"],
  })
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid token subject")
  return {
    sub: payload.sub,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
  }
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=")
    if (!rawKey) continue
    const rawValue = rest.join("=")
    result[rawKey] = decodeURIComponent(rawValue ?? "")
  }
  return result
}

export function getAuthToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization")
  if (auth) {
    const [type, value] = auth.split(" ")
    if (type?.toLowerCase() === "bearer" && value) return value.trim()
  }

  const cookieHeader = req.headers.get("cookie")
  if (!cookieHeader) return undefined
  const cookies = parseCookieHeader(cookieHeader)
  const token = cookies[SESSION_COOKIE_NAME]
  if (token && token.trim() !== "") return token
  return undefined
}

export function buildSessionSetCookie(params: {
  token: string
  secure?: boolean
  maxAgeSeconds?: number
}): string {
  const maxAge = params.maxAgeSeconds ?? 7 * 24 * 60 * 60
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(params.token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]
  if (params.secure) parts.push("Secure")
  return parts.join("; ")
}

export function buildSessionClearCookie(params?: { secure?: boolean }): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ]
  if (params?.secure) parts.push("Secure")
  return parts.join("; ")
}

