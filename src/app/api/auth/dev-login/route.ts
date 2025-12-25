import { json } from "@/app/api/_helpers"

export async function POST() {
  // 仅保留 LinuxDO OAuth 登录方式。
  return json({ error: "Not Found" }, { status: 404 })
}
