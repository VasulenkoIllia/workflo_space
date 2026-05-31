import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { AccessClaims } from '../auth/tokens.js'

const ACCESS_TTL = process.env.JWT_EXPIRES_IN ?? '15m'

/**
 * Resolve the JWT signing secret. Fail-fast OUTSIDE development if it is missing
 * or weak — never silently fall back to an empty secret (which would make every
 * access token forgeable). The previous `?? ''` fallback was a forgery vector in
 * any non-dev, non-prod environment (e.g. staging). Security audit 31.05.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'development') {
    return 'dev-only-insecure-secret-change-me-32chars'
  }
  throw new Error(
    'JWT_SECRET is required and must be ≥32 chars outside development — refusing to start with an empty/weak JWT secret'
  )
}

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
