import { ApiErrorCode, AppError, pnlQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { computePnl, pnlToCsv } from '../../services/pnl.js'

/**
 * Financial reports (S5-10) — owner-only P&L over a date window, as JSON or CSV.
 */
const reportsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/reports/pnl',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції має доступ до фінансів',
          403
        )
      }
      const pnl = await computePnl({ agencyId, from: query.from, to: query.to })
      return reply.send({ success: true, data: pnl })
    }
  )

  fastify.get(
    '/workspace/reports/pnl.csv',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції має доступ до фінансів',
          403
        )
      }
      const pnl = await computePnl({ agencyId, from: query.from, to: query.to })
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="pnl_${query.from}_${query.to}.csv"`)
        .send(pnlToCsv(pnl))
    }
  )

  return Promise.resolve()
}

export default reportsRoute
