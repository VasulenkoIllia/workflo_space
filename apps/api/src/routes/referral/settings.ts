import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { updateReferralSettingsSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { resolveReferralConfig } from '../../services/referral.js'
import { requirePermission } from '../../auth/permissions.js'

/**
 * Per-agency referral program config (S5-06). Reads resolve through the same
 * default-fallback the accrual path uses; the write is owner-only and audited
 * (it changes how future bonuses are calculated).
 */
const referralSettingsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/admin/referral/settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      await requirePermission(request, 'settings.manage')
      const config = await withTenant((tx) => resolveReferralConfig(tx, agencyId))
      return reply.send({ success: true, data: config })
    }
  )

  fastify.patch(
    '/admin/referral/settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateReferralSettingsSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      await requirePermission(request, 'settings.manage')

      const tiersJson = input.tiers as Prisma.InputJsonValue | undefined
      const settings = await tenantTransaction(prisma, (tx) =>
        tx.referralSettings.upsert({
          where: { agencyId },
          create: {
            agencyId,
            enabled: input.enabled ?? true,
            tiers: tiersJson ?? [],
            employeeReferralPercent: input.employeeReferralPercent ?? 0,
            updatedBy: user.sub,
          },
          update: {
            ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
            ...(tiersJson !== undefined ? { tiers: tiersJson } : {}),
            ...(input.employeeReferralPercent !== undefined
              ? { employeeReferralPercent: input.employeeReferralPercent }
              : {}),
            updatedBy: user.sub,
          },
          select: { enabled: true, tiers: true, employeeReferralPercent: true },
        })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'referral.settings_updated',
        resourceType: 'referral_settings',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { fields: Object.keys(input) },
      })

      return reply.send({ success: true, data: settings })
    }
  )

  return Promise.resolve()
}

export default referralSettingsRoute
