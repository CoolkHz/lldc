import { text } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { handleCreditNotify } from "@/services/order.service"

export async function GET(req: Request) {
  let db: ReturnType<typeof getEnv>["db"] | undefined
  let kv: ReturnType<typeof getEnv>["kv"] | undefined
  let config: ReturnType<typeof getEnv>["config"] | undefined

  try {
    const env = getEnv()
    db = env.db
    kv = env.kv
    config = env.config
  } catch {
    // 若 env 缺失也必须返回 success，避免回调重试风暴。
    return text("success", { status: 200 })
  }

  await handleCreditNotify({ req, db: db!, kv: kv!, config: config! })
  return text("success", { status: 200 })
}
