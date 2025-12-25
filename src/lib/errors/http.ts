export class HttpError extends Error {
  readonly status: number
  readonly cause?: unknown

  constructor(status: number, message: string, cause?: unknown) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.cause = cause
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError && typeof error.status === "number"
}

export function toPublicErrorMessage(error: unknown): string {
  if (isHttpError(error)) return error.message
  return "Internal Server Error"
}

