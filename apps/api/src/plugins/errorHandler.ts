import type { FastifyPluginAsync } from 'fastify'
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

const errorHandlerPlugin: FastifyPluginAsync = (fastify) => {
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

    if (error instanceof ZodError) {
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

  return Promise.resolve()
}

export default errorHandlerPlugin
