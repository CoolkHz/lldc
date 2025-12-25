import { NextResponse } from "next/server"

import { getEnv } from "@/lib/env"
import { HttpError } from "@/lib/errors/http"
import { signSessionToken, buildSessionSetCookie } from "@/lib/auth/jwt"
import {
  exchangeToken,
  fetchUserInfo,
  LINUXDO_OAUTH_STATE_COOKIE,
  resolveAvatarUrl,
} from "@/lib/auth/linuxdo"
import { upsertUser } from "@/repositories/users.repo"

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

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie")
  if (!header) return undefined
  return parseCookieHeader(header)[name]
}

function buildStateClearCookie(params: { secure: boolean }) {
  const parts = [
    `${LINUXDO_OAUTH_STATE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ]
  if (params.secure) parts.push("Secure")
  return parts.join("; ")
}

export async function GET(req: Request) {
  const { db, config } = getEnv()
  const url = new URL(req.url)
  const code = url.searchParams.get("code") ?? ""
  const state = url.searchParams.get("state") ?? ""
  if (!code || !state) throw new HttpError(400, "Missing code/state")

  const cookieState = getCookie(req, LINUXDO_OAUTH_STATE_COOKIE) ?? ""
  if (!cookieState || cookieState !== state) throw new HttpError(400, "Invalid state")

  const origin = url.origin
  const redirectUri = `${origin}/api/auth/callback`

  const token = await exchangeToken({
    clientId: config.linuxdo.clientId,
    clientSecret: config.linuxdo.clientSecret,
    code,
    redirectUri,
  })
  const accessToken = token.access_token
  if (!accessToken) throw new HttpError(502, "Missing access_token")

  const user = await fetchUserInfo(accessToken)
  const linuxdoUserId = String(user.id)
  const nickname = user.username
  const avatarUrl = resolveAvatarUrl(user.avatar_template)

  const userRow = await upsertUser(db, { linuxdoUserId, nickname, avatarUrl })
  if (!userRow) throw new HttpError(500, "用户写入失败")

  const jwt = await signSessionToken({ userId: linuxdoUserId, secret: config.jwtSecret })

  const secure = url.protocol === "https:"
  const res = NextResponse.redirect(`${origin}/dashboard`, { status: 302 })
  res.headers.append("set-cookie", buildStateClearCookie({ secure }))
  res.headers.append("set-cookie", buildSessionSetCookie({ token: jwt, secure }))
  res.headers.set("cache-control", "no-store")
  return res
}

