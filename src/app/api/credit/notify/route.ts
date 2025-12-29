import { errorToResponse, text } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { handleCreditNotify } from "@/services/order.service"

export async function GET(req: Request) {
  try {
    const { db, kv, config } = getEnv()
    console.info(req)
    await handleCreditNotify({ req, db, kv, config })
    return text("success", { status: 200 })
  } catch (error) {
    return errorToResponse(error)
  }
}
