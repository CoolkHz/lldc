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
    const rawDrawId = url.searchParams.get("drawId")
    const drawId = rawDrawId?.trim() ? rawDrawId.trim() : undefined
    if (drawId && !/^\d{4}-\d{2}-\d{2}$/.test(drawId)) {
      throw new HttpError(400, "drawId 格式错误（期望 YYYY-MM-DD）")
    }

    const result = await runDraw({ db, kv, config, drawId })
    if (result.status === "closing") {
      return json(result, { status: 202 })
    }
    return json(result)
  } catch (error) {
    return errorToResponse(error)
  }
}
