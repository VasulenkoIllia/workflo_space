import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, payWithBonusSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { spendBonusOnCharge } from '../../services/bonusSpend.js'

/**
 * POST /portal/invoices/:chargeId/pay-with-bonus (S5-08) — a client applies bonus
 * balance to a service charge. Atomic: debit + bonus-backed allocation commit
 * together; the bonus can't overdraw and the charge can't be over-paid.
 */
const payWithBonusRoute: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Params: { chargeId: string } }>(
    '/portal/invoices/:chargeId/pay-with-bonus',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = payWithBonusSchema.parse(request.body ?? {})
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      // Spending bonus is a money write — gate on company OWNER, not the read-only
      // `billing.view`. A view-only member must not be able to drain the wallet.
      const isCompanyOwner = user.memberships.some(
        (m) => m.companyId === companyId && m.role === 'owner'
      )
      if (!isCompanyOwner) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник компанії може оплачувати бонусами',
          403
        )
      }

      const result = await tenantTransaction(prisma, (tx) =>
        spendBonusOnCharge(tx, {
          agencyId,
          companyId,
          chargeId: request.params.chargeId,
          requestedAmount: input.amount ?? null,
          confirmedBy: user.sub,
        })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'wallet.bonus_spent',
        resourceType: 'service_charge',
        resourceId: request.params.chargeId,
        result: 'allowed',
        metadata: { companyId, spent: result.spent },
      })

      return reply.status(201).send({ success: true, data: result })
    }
  )

  return Promise.resolve()
}

export default payWithBonusRoute
