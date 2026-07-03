import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, switchAgencySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import {
  defaultActiveCompanyId,
  loadAgencyMemberships,
  loadMemberships,
} from '../../auth/memberships.js'
import { buildAccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * POST /auth/switch-agency — change the active tenant of a multi-agency staffer
 * (ADR-004). Validates the target against the caller's CURRENT agency memberships
 * (claims may be stale), persists the choice on Profile.lastActiveAgencyId so it
 * survives token refresh, and re-issues an access token scoped to the new agency.
 *
 * Does NOT rotate the refresh token — tenant selection is orthogonal to identity,
 * and the refresh cookie is path-scoped to /auth/refresh (not sent here anyway).
 */
const switchAgencyRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/switch-agency',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { agencyId } = switchAgencySchema.parse(request.body)
      const profileId = request.user.sub

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true, email: true, role: true, isActive: true },
      })
      if (!profile || !profile.isActive) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна', 401)
      }

      // Reload memberships from DB and validate the target tenant (default-deny).
      const agencyMemberships = await loadAgencyMemberships(prisma, profileId)
      if (!agencyMemberships.some((m) => m.agencyId === agencyId)) {
        writeAuditAsync(request.log, {
          actorId: profileId,
          agencyId,
          action: 'auth.switch_agency',
          resourceType: 'agency',
          resourceId: agencyId,
          result: 'denied',
          metadata: { reason: 'not_a_member', ip: request.ip },
        })
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Ви не є учасником цієї агенції', 403)
      }

      // Persist so the choice survives refresh; re-issue claims for the new tenant.
      await prisma.profile.update({
        where: { id: profileId },
        data: { lastActiveAgencyId: agencyId },
      })

      const memberships = await loadMemberships(prisma, profileId)
      const activeCompanyId = defaultActiveCompanyId(memberships)

      const claims = buildAccessClaims({
        profileId: profile.id,
        email: profile.email,
        role: profile.role,
        activeAgencyId: agencyId,
        activeCompanyId,
        agencyMemberships,
        memberships,
        // Same device/session — preserve the session id from the current token.
        sid: request.user.sid ?? null,
      })
      const accessToken = await reply.jwtSign(claims)

      writeAuditAsync(request.log, {
        actorId: profileId,
        agencyId,
        action: 'auth.switch_agency',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { ip: request.ip },
      })

      return reply.status(200).send({
        success: true,
        data: { accessToken, activeAgencyId: agencyId },
      })
    }
  )

  return Promise.resolve()
}

export default switchAgencyRoute
