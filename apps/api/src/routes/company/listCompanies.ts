import type { Prisma } from '@workflo/db'
import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { createClientCompanySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { hasPermission, requireAnyPermission, requirePermission } from '../../auth/permissions.js'
import { generateUniqueCompanySlug } from '../../auth/slug.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * GET /workspace/companies — lightweight id+name list of the agency's client companies.
 * Owner + executor only (finance-context picker for the projects screen → manager-blocked,
 * MOD-4, like the rest of the billing surface). The rich client profile lives in module 28.
 */
const listCompaniesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/companies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      // PERM-2: реєстр клієнтів — clients.view (менеджер теж); тір/валюта — з billing.view
      await requireAnyPermission(request, ['clients.view', 'orders.create', 'leads.manage'])
      const showMoney = await hasPermission(request, 'billing.view')
      const { companies, all, open, debts } = await withTenant(async (tx) => {
        const [companies, all, open] = await Promise.all([
          tx.company.findMany({
            where: { agencyId },
            select: { id: true, name: true, slug: true, loyaltyTier: true, currency: true },
            orderBy: { name: 'asc' },
          }),
          // DSN-7: реальні агрегати по ВСІХ замовленнях (раніше фронт рахував з останніх 100)
          tx.order.groupBy({
            by: ['companyId'],
            where: { agencyId, deletedAt: null, companyId: { not: null } },
            _count: { _all: true },
            _sum: { totalAmount: true },
            _max: { updatedAt: true },
          }),
          tx.order.groupBy({
            by: ['companyId'],
            where: {
              agencyId,
              deletedAt: null,
              companyId: { not: null },
              internalStatus: { notIn: ['done', 'cancelled'] },
            },
            _count: { _all: true },
          }),
        ])
        // Борг — те саме визначення, що в Білінгу/«Звітах» (DEDUP C5), лише з billing.view
        const debts = showMoney
          ? await tx.$queryRaw<{ companyId: string; debt: Prisma.Decimal }[]>`
              SELECT o."companyId" AS "companyId",
                     SUM(o."totalAmount" - COALESCE(p.paid, 0) + COALESCE(pr.refunded, 0)) AS "debt"
              FROM "orders" o
              LEFT JOIN (
                SELECT "orderId", SUM("amount") AS paid
                FROM "payments" WHERE "status" = 'confirmed'
                GROUP BY "orderId"
              ) p ON p."orderId" = o."id"
              LEFT JOIN (
                SELECT pay."orderId", SUM(r."amount") AS refunded
                FROM "payment_refunds" r
                JOIN "payments" pay ON pay."id" = r."paymentId"
                WHERE pay."status" = 'confirmed'
                GROUP BY pay."orderId"
              ) pr ON pr."orderId" = o."id"
              WHERE o."agencyId" = ${agencyId}
                AND o."paidAt" IS NULL
                AND o."totalAmount" IS NOT NULL
                AND o."deletedAt" IS NULL
                AND o."companyId" IS NOT NULL
              GROUP BY o."companyId"
              HAVING SUM(o."totalAmount" - COALESCE(p.paid, 0) + COALESCE(pr.refunded, 0)) > 0
            `
          : []
        return { companies, all, open, debts }
      })
      const allBy = new Map(all.map((r) => [r.companyId, r]))
      const openBy = new Map(open.map((r) => [r.companyId, r._count._all]))
      const debtBy = new Map(debts.map((d) => [d.companyId, Number(d.debt)]))
      return reply.send({
        success: true,
        data: {
          companies: companies.map((c) => {
            const a = allBy.get(c.id)
            const stats = {
              ordersTotal: a?._count._all ?? 0,
              ordersActive: openBy.get(c.id) ?? 0,
              lastActivityAt: a?._max.updatedAt ?? null,
            }
            return showMoney
              ? {
                  ...c,
                  ...stats,
                  totalValue: Number(a?._sum.totalAmount ?? 0),
                  debt: debtBy.get(c.id) ?? 0,
                }
              : { ...c, loyaltyTier: null, currency: null, ...stats, totalValue: null, debt: null }
          }),
        },
      })
    }
  )

  // ── CORE-FLOWS (D4): агенція заводить компанію-клієнта вручну (clients.manage) ──────
  // Без учасників: контакт запрошується окремо (POST /workspace/clients/:id/members/invite),
  // і перший прийнятий інвайт у компанію без власника робить людину власником.
  fastify.post(
    '/workspace/companies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      await requirePermission(request, 'clients.manage')
      const input = createClientCompanySchema.parse(request.body)
      const company = await tenantTransaction(prisma, async (tx) => {
        const slug = await generateUniqueCompanySlug(tx, agencyId, input.name)
        return tx.company.create({
          data: {
            agencyId,
            name: input.name,
            slug,
            language: input.language ?? 'uk',
            currency: input.currency ?? 'USD',
            ...(input.notes ? { notes: input.notes } : {}),
          },
          select: { id: true, name: true, slug: true },
        })
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'company.created_by_agency',
        resourceType: 'company',
        resourceId: company.id,
        result: 'allowed',
        metadata: { name: company.name },
      })
      return reply.status(201).send({ success: true, data: { company } })
    }
  )

  return Promise.resolve()
}

export default listCompaniesRoute
