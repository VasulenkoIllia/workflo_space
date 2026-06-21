import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

/**
 * GET /workspace/companies — lightweight id+name list of the agency's client companies.
 * Internal team only. Feeds the company picker on the financial-projects screen (and other
 * client-scoped UIs). The rich client profile lives in module 28 (client management).
 */
const listCompaniesRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/companies',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
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
