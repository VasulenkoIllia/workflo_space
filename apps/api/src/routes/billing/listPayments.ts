import { Prisma as PrismaNS, type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, billingListQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'

interface PaymentRow {
  id: string
  companyId: string
  orderId: string | null
  amount: Prisma.Decimal
  currency: string
  amountUsd: Prisma.Decimal | null
  type: string
  status: string
  paymentMethod: string | null
  paymentReference: string | null
  note: string | null
  confirmedAt: Date
  refunds: { amount: Prisma.Decimal }[]
}

const PAYMENT_SELECT = {
  id: true,
  companyId: true,
  orderId: true,
  amount: true,
  currency: true,
  amountUsd: true,
  type: true,
  status: true,
  paymentMethod: true,
  paymentReference: true,
  note: true,
  confirmedAt: true,
  refunds: { select: { amount: true } }, // 05-В: Σ повернень → залишок/бейдж
} satisfies Prisma.PaymentSelect

function toDto(p: PaymentRow) {
  return {
    id: p.id,
    companyId: p.companyId,
    orderId: p.orderId,
    amount: p.amount.toFixed(2),
    currency: p.currency,
    amountUsd: p.amountUsd ? p.amountUsd.toFixed(2) : null,
    type: p.type,
    status: p.status,
    paymentMethod: p.paymentMethod,
    paymentReference: p.paymentReference,
    note: p.note,
    confirmedAt: p.confirmedAt,
    refundedAmount: p.refunds
      .reduce((acc, r) => acc.plus(r.amount), new PrismaNS.Decimal(0))
      .toFixed(2),
  }
}

/**
 * Payment history reads. The workspace list spans the agency (optionally filtered
 * by company); the portal list is pinned to the caller's active company. Both are
 * tenant-scoped — the workspace `where` always carries `agencyId`, the portal one
 * always carries the session's `activeCompanyId`.
 */
const listPaymentsRoute: FastifyPluginAsync = (fastify) => {
  // ── Workspace: agency-wide payment history ───────────────────────────────
  fastify.get(
    '/workspace/billing/payments',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = billingListQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const where: Prisma.PaymentWhereInput = {
        agencyId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
      }
      const { rows, total } = await withTenant(async (tx) => {
        const [rows, total] = await Promise.all([
          tx.payment.findMany({
            where,
            select: PAYMENT_SELECT,
            orderBy: { confirmedAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          tx.payment.count({ where }),
        ])
        return { rows, total }
      })

      return reply.send({
        success: true,
        data: {
          payments: rows.map(toDto),
          pagination: { page: query.page, limit: query.limit, total },
        },
      })
    }
  )

  // ── Portal: the client company's own payment history ─────────────────────
  fastify.get(
    '/portal/billing/payments',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = billingListQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до білінгу', 403)
      }

      const where: Prisma.PaymentWhereInput = { agencyId, companyId }
      const { rows, total } = await withTenant(async (tx) => {
        const [rows, total] = await Promise.all([
          tx.payment.findMany({
            where,
            select: PAYMENT_SELECT,
            orderBy: { confirmedAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          tx.payment.count({ where }),
        ])
        return { rows, total }
      })

      return reply.send({
        success: true,
        data: {
          payments: rows.map(toDto),
          pagination: { page: query.page, limit: query.limit, total },
        },
      })
    }
  )

  return Promise.resolve()
}

export default listPaymentsRoute
