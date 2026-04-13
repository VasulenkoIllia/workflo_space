import rateLimit from '@fastify/rate-limit'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { ApiErrorCode } from '@workflo/types'

function getRateLimitKey(request: FastifyRequest): string {
  return request.ip
}

const rateLimitingPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: getRateLimitKey,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: ApiErrorCode.RATE_LIMITED,
        message: 'Забагато запитів. Зачекайте хвилину та спробуйте знову.',
        details: null,
      },
    }),
  })
}

export default rateLimitingPlugin
