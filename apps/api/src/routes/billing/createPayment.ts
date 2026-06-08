import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createPaymentSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { assertSameTenant, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { hashRequest, withIdempotency } from '../../services/idempotency.js'
import { confirmManualPayment } from '../../services/payments.js'

const ENDPOINT = 'POST /workspace/billing/payments'

/**
 * POST /workspace/billing/payments — an operator records a confirmed manual
 * payment (advance/final/partial) for a client company, optionally settling an
 * order. Idempotent: the `Idempotency-Key` header makes a retry / double-submit
 * replay the first response instead of creating a second payment.
 *
 * Money correctness lives in `confirmManualPayment` (FOR UPDATE lock, Decimal
 * math, FX snapshot); this handler owns authz, tenant resolution, and the
 * idempotency envelope.
 */
const createPaymentRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/workspace/billing/payments',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 120, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const input = createPaymentSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)

      // Workspace-only money action: internal team + payment.confirm (tenant-guarded).
      if (
        !isInternalTeam(user) ||
        !can(user, 'payment.confirm', { agencyId, companyId: input.companyId })
      ) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Недостатньо прав для підтвердження платежу',
          403
        )
      }

      const rawKey = request.headers['idempotency-key']
      const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey
      if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Потрібен заголовок Idempotency-Key (8–200 символів)',
          400
        )
      }

      // Resolve + tenant-guard the payer company before opening the write tx.
      const company = await withTenant((tx) =>
        tx.company.findUnique({
          where: { id: input.companyId },
          select: { id: true, agencyId: true },
        })
      )
      if (!company) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }
      assertSameTenant(user, company.agencyId)

      const requestHash = hashRequest(input)

      const outcome = await tenantTransaction(prisma, (tx) =>
        withIdempotency(
          tx,
          { key: idempotencyKey, endpoint: ENDPOINT, agencyId, requestHash },
          async () => {
            const result = await confirmManualPayment(tx, {
              agencyId,
              companyId: input.companyId,
              orderId: input.orderId ?? null,
              amount: input.amount,
              currency: input.currency,
              type: input.type,
              paymentMethod: input.paymentMethod ?? null,
              paymentReference: input.paymentReference ?? null,
              note: input.note ?? null,
              confirmedBy: user.sub,
              idempotencyKey,
            })
            return { status: 201, body: { success: true, data: result } }
          }
        )
      )

      if (!outcome.replayed) {
        const data = (outcome.body as { data?: { payment?: { id?: string } } }).data
        writeAuditAsync(request.log, {
          actorId: user.sub,
          agencyId,
          action: 'payment.created',
          resourceType: 'payment',
          resourceId: data?.payment?.id ?? null,
          result: 'allowed',
          metadata: {
            companyId: input.companyId,
            orderId: input.orderId ?? null,
            amount: input.amount,
            currency: input.currency,
            type: input.type,
          },
        })
      }

      return reply.status(outcome.status).send(outcome.body)
    }
  )

  return Promise.resolve()
}

export default createPaymentRoute
