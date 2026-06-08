import { Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, LOYALTY_DISCOUNT_PCT, type LoyaltyTier } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'

interface DebtAgg {
  debt: Prisma.Decimal
}

/**
 * GET /portal/billing/summary — everything the client portal's billing page needs
 * in one call: outstanding debt (USD + UAH), lifetime paid, loyalty tier + its
 * auto-discount, bonus balance, the active service subscriptions, and the agency's
 * pay-to bank/crypto details. All pinned to the caller's active company.
 */
const portalSummaryRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/portal/billing/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до білінгу', 403)
      }

      const data = await withTenant(async (tx) => {
        const [company, paidAgg, debtRows, services, settings, rate] = await Promise.all([
          tx.company.findUnique({
            where: { id: companyId },
            select: {
              id: true,
              agencyId: true,
              loyaltyTier: true,
              tierOverride: true,
              bonusBalance: true,
              moneyBalance: true,
            },
          }),
          tx.payment.aggregate({
            where: { agencyId, companyId, status: 'confirmed' },
            _sum: { amountUsd: true },
          }),
          tx.$queryRaw<DebtAgg[]>`
            SELECT COALESCE(SUM(o."totalAmount" - COALESCE(p.paid, 0)), 0) AS "debt"
            FROM "orders" o
            LEFT JOIN (
              SELECT "orderId", SUM("amount") AS paid
              FROM "payments" WHERE "status" = 'confirmed'
              GROUP BY "orderId"
            ) p ON p."orderId" = o."id"
            WHERE o."agencyId" = ${agencyId}
              AND o."companyId" = ${companyId}
              AND o."paidAt" IS NULL
              AND o."totalAmount" IS NOT NULL
              AND o."deletedAt" IS NULL
          `,
          tx.companyService.findMany({
            where: { companyId, active: true },
            select: {
              id: true,
              customPrice: true,
              frequency: true,
              nextChargeAt: true,
              service: { select: { id: true, name: true } },
            },
          }),
          tx.paymentSettings.findUnique({
            where: { agencyId },
            select: {
              bankName: true,
              iban: true,
              accountName: true,
              cryptoUsdt: true,
              notes: true,
              invoiceCurrency: true,
            },
          }),
          tx.exchangeRate.findUnique({ where: { agencyId }, select: { usdToUah: true } }),
        ])
        return { company, paidAgg, debtRows, services, settings, rate }
      })

      if (!data.company || data.company.agencyId !== agencyId) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }

      const tier = (data.company.tierOverride ?? data.company.loyaltyTier) as LoyaltyTier
      const debt = data.debtRows[0]?.debt ?? new Prisma.Decimal(0)
      const debtUah = data.rate ? debt.times(data.rate.usdToUah).toFixed(2) : null

      return reply.send({
        success: true,
        data: {
          debt: debt.toFixed(2),
          debtUah,
          totalPaid: (data.paidAgg._sum.amountUsd ?? new Prisma.Decimal(0)).toFixed(2),
          loyaltyTier: tier,
          discountPercent: LOYALTY_DISCOUNT_PCT[tier],
          bonusBalance: data.company.bonusBalance.toFixed(2),
          moneyBalance: data.company.moneyBalance.toFixed(2),
          services: data.services.map((s) => ({
            id: s.id,
            serviceId: s.service.id,
            name: s.service.name,
            price: s.customPrice.toFixed(2),
            frequency: s.frequency,
            nextChargeAt: s.nextChargeAt,
          })),
          paymentSettings: data.settings,
        },
      })
    }
  )

  return Promise.resolve()
}

export default portalSummaryRoute
