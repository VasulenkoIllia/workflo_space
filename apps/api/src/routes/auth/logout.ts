import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * POST /auth/logout — revoke the current refresh token and clear the cookie.
 * Idempotent: always returns 200 even if no/invalid token (don't leak state).
 * Mounted at /auth/logout, but the refresh cookie is scoped to /auth/refresh,
 * so the browser does NOT send it here — logout instead relies on the access
 * token identity (preHandler can attach it later) OR the client also calling
 * /auth/refresh path. For MVP we accept the token via body as a fallback and
 * always clear the cookie path.
 */
const logoutRoute: FastifyPluginAsync = (fastify) => {
  fastify.post('/auth/logout', async (request, reply) => {
    // The cookie is path-scoped to /auth/refresh and not sent here; the client
    // includes the token in the body for revocation. Absent token → just clear.
    const body = (request.body ?? {}) as { refreshToken?: unknown }
    const cookieToken = request.cookies?.[REFRESH_COOKIE_NAME]
    const token =
      typeof body.refreshToken === 'string'
        ? body.refreshToken
        : typeof cookieToken === 'string'
          ? cookieToken
          : null

    if (token) {
      const updated = await prisma.refreshToken.updateMany({
        where: { token, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      if (updated.count > 0) {
        const row = await prisma.refreshToken.findUnique({
          where: { token },
          select: { profileId: true },
        })
        if (row) {
          writeAuditAsync(request.log, {
            actorId: row.profileId,
            action: 'auth.logout',
            resourceType: 'profile',
            resourceId: row.profileId,
            result: 'allowed',
            metadata: { ip: request.ip },
          })
        }
      }
    }

    clearRefreshCookie(reply)
    return reply.status(200).send({ success: true, data: { loggedOut: true } })
  })

  return Promise.resolve()
}

export default logoutRoute
