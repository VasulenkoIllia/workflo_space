import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, pnlQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { computeHoursReport, hoursReportToCsv } from '../../services/hoursReport.js'
import { computePnl, pnlToCsv } from '../../services/pnl.js'

/**
 * Financial + ops reports (S5-10 / 19) — owner-only over a date window, JSON or CSV:
 * P&L and the hours plan-vs-actual report.
 */
const reportsRoute: FastifyPluginAsync = (fastify) => {
  /** Owner-gate shared by every report route. */
  function ownerAgency(user: Parameters<typeof requireActiveAgency>[0]): string {
    const agencyId = requireActiveAgency(user)
    if (!isAgencyOwner(user, agencyId)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції має доступ до звітів', 403)
    }
    return agencyId
  }

  // ── Hours plan-vs-actual (19, 12-ПЛАН-ФАКТ) ───────────────────────────────────
  fastify.get(
    '/workspace/reports/hours',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = ownerAgency(request.user)
      const report = await withTenant((tx) =>
        computeHoursReport(tx, { agencyId, from: query.from, to: query.to })
      )
      return reply.send({ success: true, data: report })
    }
  )

  fastify.get(
    '/workspace/reports/hours.csv',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = ownerAgency(request.user)
      const report = await withTenant((tx) =>
        computeHoursReport(tx, { agencyId, from: query.from, to: query.to })
      )
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="hours_${query.from}_${query.to}.csv"`)
        .send(hoursReportToCsv(report))
    }
  )

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
