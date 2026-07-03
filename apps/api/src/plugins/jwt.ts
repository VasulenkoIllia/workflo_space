import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { enterAgencyContext } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import type { AccessClaims } from '../auth/tokens.js'

const ACCESS_TTL = process.env.JWT_EXPIRES_IN ?? '15m'

/**
 * Registers @fastify/cookie (refresh token storage) and @fastify/jwt
 * (access token sign/verify). JWT_SECRET is validated at startup in prod
 * (config/env.ts); in dev a fixed fallback keeps local DX simple.
 *
 * Wrapped with fastify-plugin so jwt/cookie decorators (reply.jwtSign,
 * request.jwtVerify, reply.setCookie) apply to the PARENT instance and are
 * visible to sibling route plugins — otherwise they'd be encapsulated here.
 */
async function jwtPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(cookie, {
    // We sign refresh tokens at the app layer (opaque token), so no cookie secret needed.
    hook: 'onRequest',
  })

  await fastify.register(jwt, {
    secret: resolveJwtSecret(),
    sign: {
      expiresIn: ACCESS_TTL,
    },
  })

  /**
   * preHandler guard: verifies the Bearer access token and populates
   * request.user with AccessClaims. Use as `{ preHandler: [fastify.authenticate] }`
   * on protected routes. Throws 401 (formatted by the global error handler).
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Потрібна автентифікація', 401)
    }
    // RLS seam (F4 / ADR-007): bind the request's tenant so the DB client sets the
    // `app.current_agency_id` GUC for every query. No-op unless RLS_ENFORCED=true
    // (and the app connects as the non-superuser workflo_app role) — see @workflo/db.
    if (process.env.RLS_ENFORCED === 'true' && request.user.activeAgencyId) {
      enterAgencyContext(request.user.activeAgencyId)
    }
  })
}

export default fp(jwtPlugin, { name: 'jwt-plugin', fastify: '5.x' })

// Augment Fastify's JWT payload/user types with our claims shape.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessClaims
    user: AccessClaims
  }
}

// Augment FastifyInstance with the authenticate decorator.
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
