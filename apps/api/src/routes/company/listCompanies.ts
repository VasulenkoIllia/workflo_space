import { withTenant } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { hasPermission, requireAnyPermission } from '../../auth/permissions.js'

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
  return Promise.resolve()
}

export default listCompaniesRoute
