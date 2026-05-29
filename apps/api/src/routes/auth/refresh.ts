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
 * CSRF guard (ADR-001): /auth/refresh validates the Origin header against the
 * same allowlist the CORS plugin uses (CORS_ALLOWED_ORIGINS, comma-separated —
 * already injected into the API container by docker-compose). The refresh
 * cookie is SameSite=Lax + Path=/auth/refresh, so this is defense-in-depth.
 *
 * Policy: a request with NO Origin header is allowed (non-browser/native
 * clients can't forge cross-site requests anyway); a request WITH an Origin
 * must be in the allowlist. In dev, localhost origins are always allowed.
 */
function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function isAllowedOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin
  if (!origin) return true // no Origin → not a forgeable cross-site browser request

  if (process.env.NODE_ENV !== 'production') {
    try {
      const host = new URL(origin).hostname
      if (['localhost', '127.0.0.1', '::1'].includes(host)) return true
    } catch {
      return false
    }
  }

  const allowed = allowedOrigins()
  // If no allowlist is configured, fall back to allowing (SameSite=Lax still guards).
  if (allowed.length === 0) return true
  return allowed.includes(origin)
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
