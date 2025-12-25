import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { buildSessionClearCookie } from "@/lib/auth/jwt"

export async function POST(req: Request) {
  try {
    getEnv()
    const secure = new URL(req.url).protocol === "https:"
    const res = json({ ok: true })
    res.headers.set("set-cookie", buildSessionClearCookie({ secure }))
    return res
  } catch (error) {
    return errorToResponse(error)
  }
}

