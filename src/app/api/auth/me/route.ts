import { json, errorToResponse } from "@/app/api/_helpers"
import { getEnv } from "@/lib/env"
import { requireAuthContext } from "@/lib/auth/requireUser"

export async function GET(req: Request) {
  try {
    getEnv()
    const { user, isAdmin } = await requireAuthContext(req)
    return json({ user, isAdmin })
  } catch (error) {
    return errorToResponse(error)
  }
}

