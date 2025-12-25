import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { listParticipantsCached } from "@/services/dashboard.service"

export async function GET(req: Request, ctx: { params: Promise<{ drawId: string }> }) {
  try {
    const { db, kv, config } = getEnv()
    const { drawId } = await ctx.params
    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200)
    const cursor = Math.max(Number(url.searchParams.get("cursor") ?? 0), 0)
    const data = await listParticipantsCached({ db, kv, config, drawId, limit, cursor })
    return json(data)
  } catch (error) {
    return errorToResponse(error)
  }
}
