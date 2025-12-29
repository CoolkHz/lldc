import { NextResponse } from "next/server"

import { HttpError, isHttpError, toPublicErrorCode, toPublicErrorMessage } from "@/lib/errors/http"

type ClassifiedError = {
  status: number
  code: string
  error: string
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return ""
}

function getErrorCause(error: unknown): unknown | undefined {
  if (!error || typeof error !== "object") return undefined
  if (!("cause" in error)) return undefined
  return (error as { cause?: unknown }).cause
}

function getErrorCauseChain(error: unknown, maxDepth = 8): unknown[] {
  const out: unknown[] = []
  const seen = new Set<unknown>()

  let current: unknown = error
  for (let i = 0; i < maxDepth; i++) {
    if (!current) break
    if (seen.has(current)) break
    seen.add(current)
    out.push(current)
    current = getErrorCause(current)
  }

  return out
}

function classifyNonHttpError(error: unknown): ClassifiedError {
  const chain = getErrorCauseChain(error)
  const messages = chain.map(getUnknownErrorMessage).filter(Boolean)
  const messageBlob = messages.join("\n")

  const isD1Unavailable =
    /D1_ERROR/i.test(messageBlob) &&
    (/Failed to parse body as JSON/i.test(messageBlob) || /error code:\s*1031/i.test(messageBlob))
  if (isD1Unavailable) {
    return { status: 503, code: "DB_UNAVAILABLE", error: "数据库暂时不可用" }
  }

  const isDbQueryError =
    /SQLITE_ERROR/i.test(messageBlob) || /no such column/i.test(messageBlob) || /Failed query:/i.test(messageBlob)
  if (isDbQueryError) {
    return { status: 500, code: "DB_QUERY_ERROR", error: "数据库查询失败" }
  }

  const isKvUnavailable =
    /KV (GET|PUT) failed/i.test(messageBlob) || /Invalid expiration_ttl/i.test(messageBlob) || /expiration_ttl/i.test(messageBlob)
  if (isKvUnavailable) {
    return { status: 503, code: "KV_UNAVAILABLE", error: "缓存服务暂时不可用" }
  }

  return { status: 500, code: "INTERNAL_SERVER_ERROR", error: "Internal Server Error" }
}

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
    if (error.status >= 500) {
      console.error("[api] HttpError>=500", { status: error.status, code: error.code, message: error.message, cause: error.cause })
    }
    console.error(error.message)
    return json({ error: toPublicErrorMessage(error), code: toPublicErrorCode(error) }, { status: error.status })
  }
  const classified = classifyNonHttpError(error)
  console.error("[api] Unhandled error", { classified, error })
  return json({ error: classified.error, code: classified.code }, { status: classified.status })
}

export function getBearerToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization")
  if (!auth) return undefined
  const [type, token] = auth.split(" ")
  if (type?.toLowerCase() !== "bearer") return undefined
  return token?.trim() || undefined
}
