import { ApiErrorCode, AppError, statementQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { buildStatement } from '../../services/statement.js'

/**
 * Unified financial statement (S5-08). Portal serves the caller's own company;
 * admin serves any company in the agency and traces each bonus movement's source.
 */
const statementRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/portal/wallet/statement',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = statementQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до білінгу', 403)
      }

      const statement = await buildStatement({
        agencyId,
        companyId,
        from: query.from,
        to: query.to,
      })
      return reply.send({ success: true, data: statement })
    }
  )

  fastify.get<{ Params: { companyId: string } }>(
    '/admin/wallet/companies/:companyId/statement',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = statementQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const statement = await buildStatement({
        agencyId,
        companyId: request.params.companyId,
        from: query.from,
        to: query.to,
        includeSourceId: true,
      })
      return reply.send({ success: true, data: statement })
    }
  )

  return Promise.resolve()
}

export default statementRoute
