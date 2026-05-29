import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
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
    secret:
      process.env.JWT_SECRET ??
      (process.env.NODE_ENV === 'development' ? 'dev-only-insecure-secret-change-me-32chars' : ''),
    sign: {
      expiresIn: ACCESS_TTL,
    },
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
