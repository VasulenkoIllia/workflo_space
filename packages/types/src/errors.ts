import type { ApiErrorCode } from './enums.js'

export class AppError extends Error {
  readonly code: ApiErrorCode
  readonly statusCode: number
  readonly details?: Record<string, unknown>

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}
