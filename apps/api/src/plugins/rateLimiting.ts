import rateLimit from '@fastify/rate-limit'
import { ApiErrorCode } from '@workflo/types'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

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

// MUST be fp-wrapped: @fastify/rate-limit's `global` hook is added in the
// registering context. Without fp the plugin is encapsulated and the limiter
// never reaches the sibling route plugins — brute-force ceilings (e.g. login
// 10/15m) are silently NOT enforced (caught during S5 UI testing, 2026-06).
export default fp(rateLimitingPlugin, { name: 'rate-limiting-plugin', fastify: '5.x' })
