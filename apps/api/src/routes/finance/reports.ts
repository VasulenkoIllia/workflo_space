import { withTenant } from '@workflo/db'
import { pnlQuerySchema } from '@workflo/types'
import type { PermissionKey } from '@workflo/types'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { computeHoursReport, hoursReportToCsv } from '../../services/hoursReport.js'
import { computeLeadSourceReport } from '../../services/leadSourceReport.js'
import { computeMomReport } from '../../services/momReport.js'
import { computePnl, pnlToCsv } from '../../services/pnl.js'
import { computeRetentionReport } from '../../services/retentionReport.js'
import { computeRevenueReport } from '../../services/revenueReport.js'
import { computeSlaReport } from '../../services/slaReport.js'
import { hasPermission, requirePermission } from '../../auth/permissions.js'

/**
 * Financial + ops reports (S5-10 / 19) — owner-only over a date window, JSON or CSV:
 * P&L and the hours plan-vs-actual report.
 */
const reportsRoute: FastifyPluginAsync = (fastify) => {
  /** Owner-gate shared by every report route. */
  /** PERM-2: звіт за правом (операційні — reports.ops; грошові — finance.view). */
  async function reportAgency(request: FastifyRequest, key: PermissionKey): Promise<string> {
    const agencyId = requireActiveAgency(request.user)
    await requirePermission(request, key)
    return agencyId
  }

  // ── Hours plan-vs-actual (19, 12-ПЛАН-ФАКТ) ───────────────────────────────────
  fastify.get(
    '/workspace/reports/hours',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = await reportAgency(request, 'reports.ops')
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
      const agencyId = await reportAgency(request, 'reports.ops')
      const report = await withTenant((tx) =>
        computeHoursReport(tx, { agencyId, from: query.from, to: query.to })
      )
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="hours_${query.from}_${query.to}.csv"`)
        .send(hoursReportToCsv(report))
    }
  )

  // ── 19-А: виручка по місяцях/клієнтах + нові клієнти + дебіторка з віком ──────
  fastify.get(
    '/workspace/reports/revenue',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = await reportAgency(request, 'finance.view')
      const report = await withTenant((tx) =>
        computeRevenueReport(tx, { agencyId, from: query.from, to: query.to })
      )
      return reply.send({ success: true, data: report })
    }
  )

  // ── S11-07: retention-аналітика клієнтської бази (life-time, без вікна) ───────
  fastify.get(
    '/workspace/reports/retention',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = await reportAgency(request, 'finance.view')
      // структурний Db-інтерфейс (з groupBy) не збігається з Prisma-generic → as never
      const report = await withTenant((tx) => computeRetentionReport(tx as never, { agencyId }))
      return reply.send({ success: true, data: report })
    }
  )

  // ── 19-Д: ±% MoM для owner-дашборда ───────────────────────────────────────────
  fastify.get(
    '/workspace/reports/mom',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = await reportAgency(request, 'finance.view')
      const report = await withTenant((tx) => computeMomReport(tx, { agencyId }))
      return reply.send({ success: true, data: report })
    }
  )

  // ── SLA-compliance (S11, 02-orders §C) ────────────────────────────────────────
  fastify.get(
    '/workspace/reports/sla',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = await reportAgency(request, 'reports.ops')
      const report = await withTenant((tx) =>
        computeSlaReport(tx, { agencyId, from: query.from, to: query.to })
      )
      return reply.send({ success: true, data: report })
    }
  )

  // ── Джерела лідів: UTM → конверсія → гроші (S11, модуль 26) ──────────────────
  fastify.get(
    '/workspace/reports/lead-sources',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = await reportAgency(request, 'leads.manage')
      const report = await withTenant((tx) =>
        computeLeadSourceReport(tx, { agencyId, from: query.from, to: query.to })
      )
      // PERM-2: воронка — leads.manage; виручка по джерелах — лише з finance.view
      if (!(await hasPermission(request, 'finance.view'))) {
        return reply.send({
          success: true,
          data: {
            ...report,
            rows: report.rows.map((r) => ({ ...r, revenue: {}, paidRevenue: {} })),
          },
        })
      }
      return reply.send({ success: true, data: report })
    }
  )

  fastify.get(
    '/workspace/reports/pnl',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = await reportAgency(request, 'finance.view')
      const pnl = await computePnl({ agencyId, from: query.from, to: query.to })
      return reply.send({ success: true, data: pnl })
    }
  )

  fastify.get(
    '/workspace/reports/pnl.csv',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const agencyId = await reportAgency(request, 'finance.view')
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
