import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { HttpError } from "@/lib/errors/http"
import { getDashboard } from "@/services/dashboard.service"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const drawIdParam = url.searchParams.get("drawId")
    if (drawIdParam === null) {
      throw new HttpError(404, "缺少 drawId", "DRAW_ID_REQUIRED")
    }

    const { db, kv, config } = getEnv()
    const drawId = drawIdParam ?? undefined
    const data = await getDashboard({ db, kv, config, drawId })
    return json(data)
  } catch (error) {
    return errorToResponse(error)
  }
}
