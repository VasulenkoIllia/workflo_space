import { prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { TFA_GRACE_MS } from '../../services/twoFactorPolicy.js'

/**
 * 2FA-POLICY (рішення власника 05.07): owner toggle «вимагати 2FA у команди».
 * Enabling stamps `requireTwoFactorAt` = now → each internal member without TOTP gets a
 * 7-day grace banner, then the login funnels straight into 2FA setup (authenticate gate).
 * Disabling clears the stamp. Re-enabling restarts the grace window — деактивація/
 * реактивація не «доганяє» людей заднім числом.
 */
const patchSchema = z.object({ requireTwoFactor: z.boolean() }).strict()

function assertOwner(user: AccessClaims): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Політику безпеки змінює лише власник', 403)
  }
  return agencyId
}

const agencySecurityRoute: FastifyPluginAsync = (fastify) => {
  // ── Current policy + team 2FA coverage (owner settings card) ─────────────────
  fastify.get(
    '/workspace/agency/security',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { requireTwoFactorAt: true },
      })
      if (!agency) throw new AppError(ApiErrorCode.NOT_FOUND, 'Агенцію не знайдено', 404)

      // Coverage: which internal members already have TOTP enabled.
      const members = await withTenant((tx) =>
        tx.agencyMember.findMany({
          where: { agencyId },
          select: { profileId: true, profile: { select: { name: true } } },
        })
      )
      const enabledRows = await prisma.twoFactorAuth.findMany({
        where: { profileId: { in: members.map((m) => m.profileId) }, enabledAt: { not: null } },
        select: { profileId: true },
      })
      const enabledSet = new Set(enabledRows.map((r) => r.profileId))

      return reply.send({
        success: true,
        data: {
          requireTwoFactor: agency.requireTwoFactorAt != null,
          since: agency.requireTwoFactorAt,
          deadline: agency.requireTwoFactorAt
            ? new Date(agency.requireTwoFactorAt.getTime() + TFA_GRACE_MS)
            : null,
          members: members.map((m) => ({
            profileId: m.profileId,
            name: m.profile.name,
            twoFactorEnabled: enabledSet.has(m.profileId),
          })),
        },
      })
    }
  )

  // ── Toggle ────────────────────────────────────────────────────────────────────
  fastify.patch(
    '/workspace/agency/security',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const { requireTwoFactor } = patchSchema.parse(request.body)

      const requireTwoFactorAt = requireTwoFactor ? new Date() : null
      await prisma.agency.update({
        where: { id: agencyId },
        data: { requireTwoFactorAt },
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: requireTwoFactor ? 'agency.2fa_policy_enabled' : 'agency.2fa_policy_disabled',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { ip: request.ip },
      })
      return reply.send({
        success: true,
        data: {
          requireTwoFactor,
          since: requireTwoFactorAt,
          deadline: requireTwoFactorAt
            ? new Date(requireTwoFactorAt.getTime() + TFA_GRACE_MS)
            : null,
        },
      })
    }
  )

  return Promise.resolve()
}

export default agencySecurityRoute
