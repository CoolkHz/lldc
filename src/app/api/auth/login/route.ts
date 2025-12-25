import { NextResponse } from "next/server"

import { getEnv } from "@/lib/env"
import { buildAuthorizeUrl, generateOauthState, LINUXDO_OAUTH_STATE_COOKIE } from "@/lib/auth/linuxdo"

function buildStateSetCookie(params: { state: string; secure: boolean }) {
  const parts = [
    `${LINUXDO_OAUTH_STATE_COOKIE}=${encodeURIComponent(params.state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${10 * 60}`,
  ]
  if (params.secure) parts.push("Secure")
  return parts.join("; ")
}

export async function GET(req: Request) {
  const { config } = getEnv()
  const url = new URL(req.url)

  const origin = url.origin
  const redirectUri = `${origin}/api/auth/callback`
  const state = generateOauthState()

  const authorizeUrl = buildAuthorizeUrl({
    clientId: config.linuxdo.clientId,
    redirectUri,
    state,
    scope: config.linuxdo.scope,
  })

  const res = NextResponse.redirect(authorizeUrl, { status: 302 })
  const secure = url.protocol === "https:"
  res.headers.set("set-cookie", buildStateSetCookie({ state, secure }))
  return res
}
