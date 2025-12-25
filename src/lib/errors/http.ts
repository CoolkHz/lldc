export class HttpError extends Error {
  readonly status: number
  readonly code?: string
  readonly cause?: unknown

  constructor(status: number, message: string, cause?: unknown)
  constructor(status: number, message: string, code: string, cause?: unknown)
  constructor(status: number, message: string, codeOrCause?: string | unknown, maybeCause?: unknown) {
    super(message)
    this.name = "HttpError"
    this.status = status
    if (typeof codeOrCause === "string") {
      this.code = codeOrCause
      this.cause = maybeCause
    } else {
      this.cause = codeOrCause
    }
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError && typeof error.status === "number"
}

export function toPublicErrorMessage(error: unknown): string {
  if (isHttpError(error)) return error.message
  return "Internal Server Error"
}

function statusToDefaultCode(status: number): string {
  if (status === 400) return "BAD_REQUEST"
  if (status === 401) return "UNAUTHORIZED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 429) return "TOO_MANY_REQUESTS"
  if (status >= 500) return "INTERNAL_SERVER_ERROR"
  return "HTTP_ERROR"
}

export function toPublicErrorCode(error: unknown): string {
  if (isHttpError(error)) return error.code ?? statusToDefaultCode(error.status)
  return "INTERNAL_SERVER_ERROR"
}
