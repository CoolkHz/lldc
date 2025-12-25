import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { listDrawsCached } from "@/services/dashboard.service"

export async function GET(req: Request) {
  try {
    const { db, kv, config } = getEnv()
    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100)
    const cursor = Math.max(Number(url.searchParams.get("cursor") ?? 0), 0)
    const data = await listDrawsCached({ db, kv, config, limit, cursor })
    return json(data)
  } catch (error) {
    return errorToResponse(error)
  }
}

