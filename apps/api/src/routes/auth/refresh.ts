import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import {
  defaultActiveCompanyId,
  loadAgencyMemberships,
  loadMemberships,
  resolveActiveAgencyId,
} from '../../auth/memberships.js'
import { isOriginAllowed } from '../../config/origins.js'
import {
  buildAccessClaims,
  hashRefreshToken,
  issueRefreshToken,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * CSRF guard (ADR-001): /auth/refresh validates the Origin header against the
 * SAME allowlist the CORS plugin uses (config/origins.ts — CORS_ALLOWED_ORIGINS,
 * else the workflo prod defaults). The refresh cookie is SameSite=Lax +
 * Path=/auth/refresh, so this is defense-in-depth. No Origin header → allowed
 * (non-browser clients can't forge cross-site requests); a present Origin must be
 * allowlisted. Sharing the allowlist means it can never silently fail closed in
 * prod when CORS_ALLOWED_ORIGINS is unset (audit 2026-06).
 */
const refreshRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/refresh',
    {
      config: { rateLimit: { max: 60, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (!isOriginAllowed(request.headers.origin)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недозволене джерело запиту', 403)
      }

      const token = request.cookies?.[REFRESH_COOKIE_NAME]
      const invalid = () =>
        new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна або застаріла', 401)

      if (!token || typeof token !== 'string') {
        throw invalid()
      }

      // AR-31: the DB holds sha256 digests — hash the cookie value for the lookup.
      const stored = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(token) },
        select: {
          id: true,
          profileId: true,
          revokedAt: true,
          expiresAt: true,
          familyId: true,
          firstIssuedAt: true,
          profile: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              lastActiveAgencyId: true,
            },
          },
        },
      })

      if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
        throw invalid()
      }
      if (!stored.profile.isActive) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Акаунт деактивовано', 403)
      }

      const memberships = await loadMemberships(prisma, stored.profileId)
      const activeCompanyId = defaultActiveCompanyId(memberships)
      const agencyMemberships = await loadAgencyMemberships(prisma, stored.profileId)
      const activeAgencyId = await resolveActiveAgencyId(prisma, {
        agencyMemberships,
        activeCompanyId,
        preferredAgencyId: stored.profile.lastActiveAgencyId,
      })

      // Rotate atomically: the conditional updateMany (revokedAt IS NULL in the
      // WHERE) is the optimistic lock — a concurrent request that already rotated
      // this token sees count=0 and is rejected, so a token can't be forked into
      // two valid successors.
      const rotated = await tenantTransaction(prisma, async (tx) => {
        const revoked = await tx.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        if (revoked.count === 0) {
          throw invalid()
        }
        // Same session, new token: carry the family + original sign-in time,
        // refresh the device metadata to the current request (S9-02).
        return issueRefreshToken(tx, stored.profileId, {
          familyId: stored.familyId,
          firstIssuedAt: stored.firstIssuedAt,
          userAgent: request.headers['user-agent'] ?? null,
          ip: request.ip,
        })
      })

      const claims = buildAccessClaims({
        profileId: stored.profile.id,
        email: stored.profile.email,
        role: stored.profile.role,
        activeAgencyId,
        activeCompanyId,
        agencyMemberships,
        memberships,
        sid: stored.familyId,
      })
      const accessToken = await reply.jwtSign(claims)

      setRefreshCookie(reply, rotated.token)

      writeAuditAsync(request.log, {
        actorId: stored.profileId,
        action: 'auth.refresh_used',
        resourceType: 'profile',
        resourceId: stored.profileId,
        result: 'allowed',
        metadata: { ip: request.ip },
      })

      return reply.status(200).send({
        success: true,
        data: { accessToken, activeCompanyId },
      })
    }
  )

  return Promise.resolve()
}

export default refreshRoute
