import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'

interface DebtRow {
  companyId: string
  name: string
  debt: Prisma.Decimal
}

/** First day of the current UTC month (revenue window). */
function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * GET /workspace/billing/overview — agency money snapshot for the owner dashboard:
 * confirmed revenue (USD-snapshot, this month + lifetime) and outstanding order
 * debt with the top debtors. Revenue uses `amountUsd` (the FX snapshot) so it is a
 * single, consistent base; outstanding debt is order-native (settlement enforces a
 * matching currency per order).
 */
const overviewRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/billing/overview',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const since = monthStart(new Date())

      const result = await withTenant(async (tx) => {
        const [monthAgg, totalAgg, debtors] = await Promise.all([
          tx.payment.aggregate({
            where: { agencyId, status: 'confirmed', confirmedAt: { gte: since } },
            _sum: { amountUsd: true },
          }),
          tx.payment.aggregate({
            where: { agencyId, status: 'confirmed' },
            _sum: { amountUsd: true },
          }),
          // Outstanding per company = Σ(order.total − confirmed payments) over unpaid, priced orders.
          tx.$queryRaw<DebtRow[]>`
            SELECT o."companyId" AS "companyId", c."name" AS "name",
                   SUM(o."totalAmount" - COALESCE(p.paid, 0)) AS "debt"
            FROM "orders" o
            JOIN "companies" c ON c."id" = o."companyId"
            LEFT JOIN (
              SELECT "orderId", SUM("amount") AS paid
              FROM "payments" WHERE "status" = 'confirmed'
              GROUP BY "orderId"
            ) p ON p."orderId" = o."id"
            WHERE o."agencyId" = ${agencyId}
              AND o."paidAt" IS NULL
              AND o."totalAmount" IS NOT NULL
              AND o."deletedAt" IS NULL
              AND o."companyId" IS NOT NULL
            GROUP BY o."companyId", c."name"
            HAVING SUM(o."totalAmount" - COALESCE(p.paid, 0)) > 0
            ORDER BY "debt" DESC
          `,
        ])
        return { monthAgg, totalAgg, debtors }
      })

      const outstandingDebt = result.debtors.reduce(
        (sum, d) => sum.plus(d.debt),
        new Prisma.Decimal(0)
      )
      const topDebtors = result.debtors.slice(0, 5).map((d) => ({
        companyId: d.companyId,
        name: d.name,
        debt: d.debt.toFixed(2),
      }))

      return reply.send({
        success: true,
        data: {
          monthlyRevenueUsd: (result.monthAgg._sum.amountUsd ?? new Prisma.Decimal(0)).toFixed(2),
          totalRevenueUsd: (result.totalAgg._sum.amountUsd ?? new Prisma.Decimal(0)).toFixed(2),
          outstandingDebt: outstandingDebt.toFixed(2),
          topDebtors,
        },
      })
    }
  )

  return Promise.resolve()
}

export default overviewRoute
