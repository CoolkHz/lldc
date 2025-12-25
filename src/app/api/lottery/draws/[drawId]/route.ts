import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { getDrawDetailCached } from "@/services/dashboard.service"

export async function GET(_req: Request, ctx: { params: Promise<{ drawId: string }> }) {
  try {
    const { db, kv, config } = getEnv()
    const { drawId } = await ctx.params
    const data = await getDrawDetailCached({ db, kv, config, drawId })
    return json(data)
  } catch (error) {
    return errorToResponse(error)
  }
}
