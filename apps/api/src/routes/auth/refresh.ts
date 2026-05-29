import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import {
  buildAccessClaims,
  issueRefreshToken,
  type Membership,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * CSRF guard (ADR-001): /auth/refresh accepts only same-origin POSTs. The
 * refresh cookie is SameSite=Lax + Path=/auth/refresh, so this Origin check is
 * defense-in-depth. In dev (no Origin or localhost) we allow it for DX.
 */
function isAllowedOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin
  if (process.env.NODE_ENV !== 'production') {
    if (!origin) return true
    try {
      const host = new URL(origin).hostname
      if (['localhost', '127.0.0.1', '::1'].includes(host)) return true
    } catch {
      return false
    }
  }
  const allowed = [
    process.env.APP_LANDING_URL,
    process.env.APP_PORTAL_URL,
    process.env.APP_WORKSPACE_URL,
  ].filter(Boolean)
  return !!origin && allowed.includes(origin)
}

const refreshRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/refresh',
    {
      config: { rateLimit: { max: 60, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (!isAllowedOrigin(request)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недозволене джерело запиту', 403)
      }

      const token = request.cookies?.[REFRESH_COOKIE_NAME]
      const invalid = () =>
        new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна або застаріла', 401)

      if (!token || typeof token !== 'string') {
        throw invalid()
      }

      const stored = await prisma.refreshToken.findUnique({
        where: { token },
        select: {
          id: true,
          profileId: true,
          revokedAt: true,
          expiresAt: true,
          profile: {
            select: { id: true, email: true, role: true, isActive: true },
          },
        },
      })

      if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
        throw invalid()
      }
      if (!stored.profile.isActive) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Акаунт деактивовано', 403)
      }

      const memberRows = await prisma.companyMember.findMany({
        where: { profileId: stored.profileId },
        select: { companyId: true, role: true },
        orderBy: { joinedAt: 'asc' },
      })
      const memberships: Membership[] = memberRows.map((m) => ({
        companyId: m.companyId,
        role: m.role,
      }))
      const activeCompanyId = memberships[0]?.companyId ?? null

      // Rotate: revoke the used token and issue a fresh one in one transaction.
      const rotated = await prisma.$transaction(async (tx) => {
        await tx.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        })
        return issueRefreshToken(tx, stored.profileId)
      })

      const claims = buildAccessClaims({
        profileId: stored.profile.id,
        email: stored.profile.email,
        role: stored.profile.role,
        activeCompanyId,
        memberships,
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
