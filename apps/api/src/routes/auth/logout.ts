import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { clearRefreshCookie } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * POST /auth/logout — revoke refresh token(s) for the AUTHENTICATED user and
 * clear the cookie. Requires a valid access token (the refresh cookie is
 * path-scoped to /auth/refresh and not sent here).
 *
 * Revocation is always scoped to request.user.sub so a leaked token value can
 * never be used to log out someone else:
 *   - body.refreshToken present → revoke just that token (this session)
 *   - body.refreshToken absent  → revoke ALL the user's active tokens (logout everywhere)
 */
const logoutRoute: FastifyPluginAsync = (fastify) => {
  fastify.post('/auth/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const profileId = request.user.sub
    const body = (request.body ?? {}) as { refreshToken?: unknown }
    const token = typeof body.refreshToken === 'string' ? body.refreshToken : null

    const where = token ? { token, profileId, revokedAt: null } : { profileId, revokedAt: null }

    const updated = await prisma.refreshToken.updateMany({
      where,
      data: { revokedAt: new Date() },
    })

    if (updated.count > 0) {
      writeAuditAsync(request.log, {
        actorId: profileId,
        action: 'auth.logout',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { ip: request.ip, scope: token ? 'single' : 'all', revoked: updated.count },
      })
    }

    clearRefreshCookie(reply)
    return reply.status(200).send({ success: true, data: { loggedOut: true } })
  })

  return Promise.resolve()
}

export default logoutRoute
