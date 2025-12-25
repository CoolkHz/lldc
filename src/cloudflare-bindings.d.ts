/* eslint-disable @typescript-eslint/no-unused-vars */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    LOTTERY_KV: KVNamespace

    JWT_SECRET: string
    CREDIT_PID: string
    CREDIT_KEY: string
    DRAW_RUN_TOKEN: string

    ADMIN_USER_IDS?: string
    LINUXDO_FEE_RATE?: string

    CACHE_VERSION?: string
    CACHE_TTL_DASHBOARD?: string
    CACHE_TTL_POOL?: string
    CACHE_TTL_DRAWS_LIST?: string
    CACHE_TTL_DRAW_DETAIL?: string
    CACHE_TTL_PARTICIPANTS?: string

    CREDIT_NOTIFY_URL?: string
    CREDIT_RETURN_URL?: string

    LINUXDO_CLIENT_ID?: string
    LINUXDO_CLIENT_SECRET?: string
    LINUXDO_SCOPE?: string
  }
}

export {}
