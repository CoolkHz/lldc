import { errorToResponse, html, readJson } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { requireUser } from "@/lib/auth/requireUser"
import { HttpError } from "@/lib/errors/http"
import { createOrderAndRenderPayForm } from "@/services/order.service"

export async function POST(req: Request) {
  try {
    const { db, config } = getEnv()
    const user = await requireUser(req)

    const body = await readJson(req)
    if (!body || typeof body !== "object") throw new HttpError(400, "请求体必须为 JSON 对象")
    const obj = body as Record<string, unknown>
    const ticketCount = Number(obj.ticketCount)
    const numbers = obj.numbers

    const result = await createOrderAndRenderPayForm({
      req,
      db,
      config,
      user: {
        linuxdoUserId: user.linuxdoUserId,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      },
      ticketCount,
      numbers,
    })

    return html(result.html, { status: 200 })
  } catch (error) {
    return errorToResponse(error)
  }
}
