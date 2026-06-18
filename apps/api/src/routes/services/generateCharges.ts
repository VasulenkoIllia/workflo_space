import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, generateChargesSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { endOfMonthUtc, generateRecurringCharges } from '../../services/recurringCharges.js'

/**
 * POST /workspace/billing/charges/generate — manual fallback for the recurring-charge
 * cron (S5-03b). Generates the charges due for a given month, scoped to the caller's
 * agency. Shares the exact generation logic with the cron, so a manual run produces
 * the same rows; the `(projectId, periodStart)` unique constraint keeps it idempotent.
 */
const generateChargesRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/workspace/billing/charges/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = generateChargesSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const result = await tenantTransaction(prisma, (tx) =>
        generateRecurringCharges(tx, { now: endOfMonthUtc(input.month), agencyId })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'billing.charges_generated',
        resourceType: 'service_charge',
        resourceId: input.month,
        result: 'allowed',
        metadata: {
          month: input.month,
          created: result.created,
          due: result.due,
          gated: result.gated,
        },
      })
      return reply.send({ success: true, data: result })
    }
  )

  return Promise.resolve()
}

export default generateChargesRoute
