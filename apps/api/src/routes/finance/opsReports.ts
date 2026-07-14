import { prisma, withTenant } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOwnerAgency } from '../../auth/tenant.js'

/**
 * DSN-2 (workspace-reports.jsx): три нові зрізи 6-таб хабу звітів.
 * - /workspace/reports/departments — агрегація по підрозділах (години/throughput/cycle/utilization)
 * - /workspace/reports/timesheet   — плоска стрічка тайм-логів (дата · хто · задача · клієнт · коментар)
 * - /workspace/reports/audit       — журнал подій агенції з audit_logs (read-only)
 * Owner-only, як і решта фінансово-аналітичних звітів.
 */
const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const opsReportsRoute: FastifyPluginAsync = (fastify) => {
  // ── Підрозділи ────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/reports/departments',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireOwnerAgency(request.user, 'Звіти доступні лише власнику')
      const q = rangeSchema.parse(request.query)
      const from = new Date(q.from)
      const to = new Date(`${q.to}T23:59:59.999Z`)
      const weeks = Math.max((to.getTime() - from.getTime()) / (7 * 86_400_000), 1 / 7)

      const data = await withTenant(async (tx) => {
        const teams = await tx.team.findMany({
          where: { agencyId },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            color: true,
            lead: { select: { name: true } },
            members: { select: { profileId: true, weeklyCapacityHours: true } },
          },
        })
        // Фіналізовані години періоду по виконавцях (той самий фільтр, що в hoursReport)
        const logs = await tx.timeLog.groupBy({
          by: ['executorId'],
          where: {
            agencyId,
            date: { gte: from, lte: to },
            OR: [{ startedAt: null }, { endedAt: { not: null } }],
          },
          _sum: { hours: true },
        })
        // Задачі команд: done у періоді (throughput + cycle) і активні зараз
        const doneTasks = await tx.internalTask.findMany({
          where: {
            agencyId,
            teamId: { not: null },
            status: 'done',
            updatedAt: { gte: from, lte: to },
          },
          select: { teamId: true, createdAt: true, updatedAt: true },
        })
        const activeCounts = await tx.internalTask.groupBy({
          by: ['teamId'],
          where: { agencyId, teamId: { not: null }, status: { not: 'done' } },
          _count: { _all: true },
        })
        return { teams, logs, doneTasks, activeCounts }
      })

      const hoursByExec = new Map(data.logs.map((l) => [l.executorId, Number(l._sum.hours ?? 0)]))
      const activeByTeam = new Map(data.activeCounts.map((a) => [a.teamId, a._count._all]))

      const rows = data.teams.map((t) => {
        const hours = t.members.reduce((s, m) => s + (hoursByExec.get(m.profileId) ?? 0), 0)
        const done = data.doneTasks.filter((d) => d.teamId === t.id)
        const cycleDays = done.length
          ? done.reduce(
              (s, d) => s + (d.updatedAt.getTime() - d.createdAt.getTime()) / 86_400_000,
              0
            ) / done.length
          : null
        const capacity = t.members.reduce((s, m) => s + (m.weeklyCapacityHours ?? 40), 0) * weeks
        return {
          teamId: t.id,
          name: t.name,
          color: t.color,
          leadName: t.lead?.name ?? null,
          members: t.members.length,
          hours: Math.round(hours * 10) / 10,
          tasksDone: done.length,
          tasksActive: activeByTeam.get(t.id) ?? 0,
          avgCycleDays: cycleDays != null ? Math.round(cycleDays * 10) / 10 : null,
          utilizationPct: capacity > 0 ? Math.round((hours / capacity) * 100) : null,
        }
      })
      return reply.send({ success: true, data: { departments: rows } })
    }
  )

  // ── Timesheet ─────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/reports/timesheet',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireOwnerAgency(request.user, 'Звіти доступні лише власнику')
      const q = rangeSchema.parse(request.query)
      const rows = await withTenant((tx) =>
        tx.timeLog.findMany({
          where: {
            agencyId,
            date: { gte: new Date(q.from), lte: new Date(`${q.to}T23:59:59.999Z`) },
            OR: [{ startedAt: null }, { endedAt: { not: null } }],
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 500,
          select: {
            id: true,
            date: true,
            hours: true,
            comment: true,
            executor: { select: { id: true, name: true } },
            order: {
              select: { id: true, title: true, company: { select: { name: true } } },
            },
          },
        })
      )
      return reply.send({
        success: true,
        data: {
          entries: rows.map((r) => ({
            id: r.id,
            date: r.date.toISOString().slice(0, 10),
            hours: Number(r.hours),
            comment: r.comment,
            executorId: r.executor.id,
            executorName: r.executor.name,
            orderId: r.order.id,
            orderTitle: r.order.title,
            companyName: r.order.company?.name ?? null,
          })),
        },
      })
    }
  )

  // ── Audit log ─────────────────────────────────────────────────────────────────
  fastify.get(
    '/workspace/reports/audit',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireOwnerAgency(request.user, 'Журнал подій доступний лише власнику')
      // audit_logs — не tenant-RLS-таблиця (agencyId nullable, є system-події) → raw prisma
      // з явним where agencyId. Read-only.
      const events = await prisma.auditLog.findMany({
        where: { agencyId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          createdAt: true,
          action: true,
          resourceType: true,
          resourceId: true,
          result: true,
          metadata: true,
          actor: { select: { name: true } },
          actorId: true,
        },
      })
      const mapped = events.map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        result: e.result,
        metadata: e.metadata,
        actorName: e.actor?.name ?? (e.actorId === 'public' ? 'public' : 'system'),
        isSystem: e.actor == null,
      }))
      return reply.send({
        success: true,
        data: {
          events: mapped,
          counts: {
            total: mapped.length,
            user: mapped.filter((e) => !e.isSystem).length,
            system: mapped.filter((e) => e.isSystem).length,
          },
        },
      })
    }
  )

  return Promise.resolve()
}

export default opsReportsRoute
