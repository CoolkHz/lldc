import { getCloudflareContext } from "@opennextjs/cloudflare"

import { HttpError } from "@/lib/errors/http"
import { getDb, type DbClient } from "@/lib/db/client"

type CacheTtls = {
  dashboardSeconds: number
  poolSeconds: number
  drawsListSeconds: number
  drawDetailSeconds: number
  participantsSeconds: number
}

export type AppConfig = {
  jwtSecret: string
  linuxdo: {
    clientId: string
    clientSecret: string
    scope?: string
  }
  credit: {
    pid: string
    key: string
    baseUrl: string
    submitUrl: string
    notifyUrl?: string
    returnUrl?: string
  }
  drawRunToken: string
  adminUserIds: ReadonlySet<string>
  linuxdoFeeRate: number
  cacheVersion: string
  cacheTtls: CacheTtls
}

export type EnvContext = {
  env: CloudflareEnv
  db: DbClient
  kv: KVNamespace
  config: AppConfig
}

function getOptionalEnvString(env: Record<string, unknown>, key: string): string | undefined {
  const value = env[key]
  if (typeof value === "string" && value.trim() !== "") return value
  return undefined
}

function getRequiredEnvString(env: Record<string, unknown>, key: string): string {
  const value = getOptionalEnvString(env, key) ?? getOptionalEnvString(process.env, key)
  if (!value) throw new HttpError(500, `缺少环境变量 ${key}`)
  return value
}

function getOptionalNumber(env: Record<string, unknown>, key: string): number | undefined {
  const raw = getOptionalEnvString(env, key) ?? getOptionalEnvString(process.env, key)
  if (!raw) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new HttpError(500, `环境变量 ${key} 不是有效数字：${raw}`)
  return value
}

function getOptionalInt(env: Record<string, unknown>, key: string): number | undefined {
  const value = getOptionalNumber(env, key)
  if (value === undefined) return undefined
  const int = Math.trunc(value)
  if (int !== value) throw new HttpError(500, `环境变量 ${key} 必须为整数：${value}`)
  return int
}

function parseAdminUserIds(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export function getEnv(): EnvContext {
  const { env } = getCloudflareContext()

  const dbBinding = (env as unknown as Record<string, unknown>).DB as D1Database | undefined
  const kvBinding = (env as unknown as Record<string, unknown>).LOTTERY_KV as KVNamespace | undefined

  if (!dbBinding) {
    throw new HttpError(500, "缺少 env.DB（请在 wrangler / Cloudflare Dashboard 绑定 D1，binding=DB）")
  }
  if (!kvBinding) {
    throw new HttpError(500, "缺少 env.LOTTERY_KV（请在 wrangler / Cloudflare Dashboard 绑定 KV，binding=LOTTERY_KV）")
  }

  const jwtSecret = getRequiredEnvString(env as unknown as Record<string, unknown>, "JWT_SECRET")
  const linuxdoClientId = getRequiredEnvString(env as unknown as Record<string, unknown>, "LINUXDO_CLIENT_ID")
  const linuxdoClientSecret = getRequiredEnvString(env as unknown as Record<string, unknown>, "LINUXDO_CLIENT_SECRET")
  const linuxdoScope = getOptionalEnvString(env as unknown as Record<string, unknown>, "LINUXDO_SCOPE")
  const creditPid = getRequiredEnvString(env as unknown as Record<string, unknown>, "CREDIT_PID")
  const creditKey = getRequiredEnvString(env as unknown as Record<string, unknown>, "CREDIT_KEY")
  const drawRunToken = getRequiredEnvString(env as unknown as Record<string, unknown>, "DRAW_RUN_TOKEN")

  const linuxdoFeeRate = getOptionalNumber(env as unknown as Record<string, unknown>, "LINUXDO_FEE_RATE") ?? 0
  if (linuxdoFeeRate < 0 || linuxdoFeeRate > 1) {
    throw new HttpError(500, `LINUXDO_FEE_RATE 必须在 [0,1]：${linuxdoFeeRate}`)
  }

  const cacheVersion = getOptionalEnvString(env as unknown as Record<string, unknown>, "CACHE_VERSION") ?? "v1"
  const cacheTtls: CacheTtls = {
    dashboardSeconds:
      getOptionalInt(env as unknown as Record<string, unknown>, "CACHE_TTL_DASHBOARD") ?? 30,
    poolSeconds: getOptionalInt(env as unknown as Record<string, unknown>, "CACHE_TTL_POOL") ?? 20,
    drawsListSeconds:
      getOptionalInt(env as unknown as Record<string, unknown>, "CACHE_TTL_DRAWS_LIST") ?? 600,
    drawDetailSeconds:
      getOptionalInt(env as unknown as Record<string, unknown>, "CACHE_TTL_DRAW_DETAIL") ?? 86400,
    participantsSeconds:
      getOptionalInt(env as unknown as Record<string, unknown>, "CACHE_TTL_PARTICIPANTS") ?? 30,
  }

  const config: AppConfig = {
    jwtSecret,
    linuxdo: {
      clientId: linuxdoClientId,
      clientSecret: linuxdoClientSecret,
      scope: linuxdoScope,
    },
    credit: {
      pid: creditPid,
      key: creditKey,
      baseUrl: "https://credit.linux.do/epay",
      submitUrl: "https://credit.linux.do/epay/pay/submit.php",
      notifyUrl: getOptionalEnvString(env as unknown as Record<string, unknown>, "CREDIT_NOTIFY_URL"),
      returnUrl: getOptionalEnvString(env as unknown as Record<string, unknown>, "CREDIT_RETURN_URL"),
    },
    drawRunToken,
    adminUserIds: parseAdminUserIds(getOptionalEnvString(env as unknown as Record<string, unknown>, "ADMIN_USER_IDS")),
    linuxdoFeeRate,
    cacheVersion,
    cacheTtls,
  }

  return {
    env,
    db: getDb(dbBinding),
    kv: kvBinding,
    config,
  }
}
