import { prisma, tenantTransaction } from '@workflo/db'
import { allocatePaymentSchema, ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { allocatePayment } from '../../services/allocation.js'

/**
 * POST /workspace/billing/payments/:id/allocate (S5-07) — an operator allocates a
 * confirmed payment to one or more service charges (explicit `{chargeId, amount}`
 * pairs, or FIFO over the unallocated remainder). Money correctness — the
 * over-allocation guard, charge-state derivation, and the `moneyBalance` recompute —
 * lives in `allocatePayment` under a payment row lock; this handler owns authz +
 * the tenant transaction envelope. Workspace-only money action (internal team +
 * `payment.confirm`).
 */
const allocatePaymentRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/workspace/billing/payments/:id/allocate',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 120, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = allocatePaymentSchema.parse(request.body ?? {})
      const user = request.user
      const agencyId = requireActiveAgency(user)

      if (!isInternalTeam(user) || !can(user, 'payment.confirm', { agencyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недостатньо прав для розподілу платежу', 403)
      }

      const result = await tenantTransaction(prisma, (tx) =>
        allocatePayment(tx, { agencyId, paymentId: id, allocations: body.allocations })
      )

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'payment.allocated',
        resourceType: 'payment',
        resourceId: id,
        result: 'allowed',
        metadata: {
          allocated: result.allocated,
          charges: result.charges.length,
          moneyBalance: result.moneyBalance,
        },
      })

      return reply.send({ success: true, data: result })
    }
  )

  return Promise.resolve()
}

export default allocatePaymentRoute
