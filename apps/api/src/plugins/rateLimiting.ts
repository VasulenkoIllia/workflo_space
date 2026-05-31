import rateLimit from '@fastify/rate-limit'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { ApiErrorCode } from '@workflo/types'

function getRateLimitKey(request: FastifyRequest): string {
  return request.ip
}

/**
 * ⚠️ Operational constraint (audit 31.05): the default store is IN-MEMORY, so
 * limits are per-replica. The API must run as a SINGLE replica until a shared
 * store (Redis) is added — otherwise the auth brute-force ceilings (login 10/15m)
 * multiply by replica count. See ADR-004 amendment + BACKLOG.
 */
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
