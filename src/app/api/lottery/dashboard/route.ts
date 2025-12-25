import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { getDashboard } from "@/services/dashboard.service"

export async function GET(req: Request) {
  try {
    const { db, kv, config } = getEnv()
    const url = new URL(req.url)
    const drawId = url.searchParams.get("drawId") ?? undefined
    const data = await getDashboard({ db, kv, config, drawId })
    return json(data)
  } catch (error) {
    return errorToResponse(error)
  }
}

