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
      const companies = await withTenant((tx) =>
        tx.company.findMany({
          where: { agencyId },
          select: { id: true, name: true, slug: true, loyaltyTier: true, currency: true },
          orderBy: { name: 'asc' },
        })
      )
      return reply.send({
        success: true,
        data: {
          companies: showMoney
            ? companies
            : companies.map((c) => ({ ...c, loyaltyTier: null, currency: null })),
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
