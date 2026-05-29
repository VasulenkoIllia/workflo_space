import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { AppError, ApiErrorCode } from '@workflo/types'

interface ValidationIssue {
  field: string
  message: string
}

function mapZodErrors(error: ZodError): ValidationIssue[] {
  return error.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))
}

function extractFastifyValidation(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'validation' in error) {
    return (error as { validation?: unknown }).validation ?? null
  }

  return null
}

/**
 * Detect a ZodError robustly. `instanceof` can fail when the schema's Zod
 * instance differs from this module's (cross-package module resolution), so
 * we also structurally sniff the ZodError shape as a fallback.
 */
function isZodError(error: unknown): error is ZodError {
  if (error instanceof ZodError) return true
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  )
}

/**
 * Register the global error + not-found handlers directly on the ROOT instance.
 *
 * Must run on root (not via an encapsulated plugin) so it covers every route
 * group — Fastify error handlers cascade down from the context they're set on,
 * and an encapsulated plugin's handler would never reach sibling routes.
 */
export function registerErrorHandlers(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      })
    }

    if (isZodError(error)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Перевірте правильність введених даних',
          details: mapZodErrors(error),
        },
      })
    }

    const validation = extractFastifyValidation(error)

    if (validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Невірні вхідні дані',
          details: validation,
        },
      })
    }

    request.log.error({ err: error }, 'Unhandled error')

    return reply.status(500).send({
      success: false,
      error: {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'Щось пішло не так. Ми вже працюємо над виправленням.',
        details: null,
      },
    })
  })

  fastify.setNotFoundHandler((_, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: 'Endpoint не знайдено',
        details: null,
      },
    })
  })
}
