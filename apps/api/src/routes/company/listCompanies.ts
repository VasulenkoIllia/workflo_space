import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'

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
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const companies = await withTenant((tx) =>
        tx.company.findMany({
          where: { agencyId },
          select: { id: true, name: true, slug: true, loyaltyTier: true, currency: true },
          orderBy: { name: 'asc' },
        })
      )
      return reply.send({ success: true, data: { companies } })
    }
  )
  return Promise.resolve()
}

export default listCompaniesRoute
