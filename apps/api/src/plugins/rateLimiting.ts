import rateLimit from '@fastify/rate-limit'
import { AppError, ApiErrorCode } from '@workflo/types'
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
    // @fastify/rate-limit THROWS whatever this returns. A plain object reached the error
    // handler as an unknown error → 500 + Sentry noise; an AppError carries its 429 and goes
    // out in the standard envelope (Retry-After header is set by the plugin).
    errorResponseBuilder: (_request, context) =>
      new AppError(
        ApiErrorCode.RATE_LIMITED,
        'Забагато запитів. Зачекайте трохи та спробуйте знову.',
        429,
        { retryAfterSeconds: Math.ceil(context.ttl / 1000) }
      ),
  })
}

// MUST be fp-wrapped: @fastify/rate-limit's `global` hook is added in the
// registering context. Without fp the plugin is encapsulated and the limiter
// never reaches the sibling route plugins — brute-force ceilings (e.g. login
// 10/15m) are silently NOT enforced (caught during S5 UI testing, 2026-06).
export default fp(rateLimitingPlugin, { name: 'rate-limiting-plugin', fastify: '5.x' })
