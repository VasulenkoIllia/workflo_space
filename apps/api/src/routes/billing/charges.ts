import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, billingListQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

interface ChargeRow {
  id: string
  companyId: string
  amount: Prisma.Decimal
  baseAmount: Prisma.Decimal | null
  discountPct: Prisma.Decimal | null
  discountAmount: Prisma.Decimal | null
  totalAmount: Prisma.Decimal | null
  currency: string
  month: Date
  status: string
  dueDate: Date | null
  paidAt: Date | null
}

const CHARGE_SELECT = {
  id: true,
  companyId: true,
  amount: true,
  baseAmount: true,
  discountPct: true,
  discountAmount: true,
  totalAmount: true,
  currency: true,
  month: true,
  status: true,
  dueDate: true,
  paidAt: true,
} satisfies Prisma.ServiceChargeSelect

function toDto(c: ChargeRow) {
  return {
    id: c.id,
    companyId: c.companyId,
    amount: c.amount.toFixed(2),
    baseAmount: c.baseAmount ? c.baseAmount.toFixed(2) : null,
    discountPct: c.discountPct ? c.discountPct.toString() : null,
    discountAmount: c.discountAmount ? c.discountAmount.toFixed(2) : null,
    totalAmount: c.totalAmount ? c.totalAmount.toFixed(2) : null,
    currency: c.currency,
    month: c.month.toISOString().slice(0, 7),
    status: c.status,
    dueDate: c.dueDate,
    paidAt: c.paidAt,
  }
}

/** Parse `YYYY-MM` to the first-of-month UTC Date that `ServiceCharge.month` stores. */
function monthFilter(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`)
}

/**
 * Service-charge reads. Workspace lists agency charges (optionally by company /
 * month); portal lists the caller's active company. Charges are produced by the
 * recurring-charge cron (S5-03b) — these endpoints are read-only and tenant-scoped.
 */
const chargesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/billing/charges',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = billingListQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const where: Prisma.ServiceChargeWhereInput = {
        agencyId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.month ? { month: monthFilter(query.month) } : {}),
      }
      const rows = await withTenant((tx) =>
        tx.serviceCharge.findMany({
          where,
          select: CHARGE_SELECT,
          orderBy: [{ month: 'desc' }, { id: 'asc' }],
          take: query.limit,
          skip: (query.page - 1) * query.limit,
        })
      )

      return reply.send({ success: true, data: { charges: rows.map(toDto) } })
    }
  )

  fastify.get(
    '/portal/billing/charges',
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

      const where: Prisma.ServiceChargeWhereInput = {
        agencyId,
        companyId,
        ...(query.month ? { month: monthFilter(query.month) } : {}),
      }
      const rows = await withTenant((tx) =>
        tx.serviceCharge.findMany({
          where,
          select: CHARGE_SELECT,
          orderBy: [{ month: 'desc' }, { id: 'asc' }],
          take: query.limit,
          skip: (query.page - 1) * query.limit,
        })
      )

      return reply.send({ success: true, data: { charges: rows.map(toDto) } })
    }
  )

  return Promise.resolve()
}

export default chargesRoute
