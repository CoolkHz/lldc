import { HttpError } from "@/lib/errors/http"
import { getEnv } from "@/lib/env"
import { getAuthToken, verifySessionToken } from "@/lib/auth/jwt"
import { getUserById } from "@/repositories/users.repo"

export async function requireUser(req: Request) {
  const { db, config } = getEnv()
  const token = getAuthToken(req)
  if (!token) throw new HttpError(401, "未登录")

  let claims: { sub: string }
  try {
    claims = await verifySessionToken({ token, secret: config.jwtSecret })
  } catch (error) {
    throw new HttpError(401, "登录已失效", error)
  }

  const user = await getUserById(db, claims.sub)
  if (!user) throw new HttpError(401, "用户不存在")

  // TODO: schema 未包含 token_version / disabled，后续接入 linuxdo 登录时应加字段以支持吊销与封禁。
  return user
}

export async function requireAuthContext(req: Request) {
  const { config } = getEnv()
  const user = await requireUser(req)
  const isAdmin = config.adminUserIds.has(user.linuxdoUserId)
  return { user, isAdmin }
}

