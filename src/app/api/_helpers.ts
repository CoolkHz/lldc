import { NextResponse } from "next/server"

import { HttpError, isHttpError, toPublicErrorMessage } from "@/lib/errors/http"

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch (error) {
    throw new HttpError(400, "JSON 解析失败", error)
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function text(body: string, init?: ResponseInit) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  })
}

export function html(body: string, init?: ResponseInit) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  })
}

export function errorToResponse(error: unknown) {
  if (isHttpError(error)) {
    return json({ error: toPublicErrorMessage(error) }, { status: error.status })
  }
  return json({ error: "Internal Server Error" }, { status: 500 })
}

export function getBearerToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization")
  if (!auth) return undefined
  const [type, token] = auth.split(" ")
  if (type?.toLowerCase() !== "bearer") return undefined
  return token?.trim() || undefined
}

