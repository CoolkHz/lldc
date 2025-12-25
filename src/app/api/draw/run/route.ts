import { json, errorToResponse, getBearerToken } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { HttpError } from "@/lib/errors/http"
import { runDraw } from "@/services/draw.service"

export async function POST(req: Request) {
  try {
    const { db, kv, config } = getEnv()
    const token = getBearerToken(req)
    if (!token || token !== config.drawRunToken) throw new HttpError(401, "未授权")

    const url = new URL(req.url)
    const drawId = url.searchParams.get("drawId") ?? undefined

    const result = await runDraw({ db, kv, config, drawId })
    if (result.status === "closing") {
      return json(result, { status: 202 })
    }
    return json(result)
  } catch (error) {
    return errorToResponse(error)
  }
}
