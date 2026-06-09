import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createTimeLogSchema, updateTimeLogSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'
import { isPeriodLocked, periodOf } from '../../services/payout.js'
import { requireTeamOrder } from './access.js'

/**
 * Time logs in a period that has an approved/paid payout are frozen (S5-04) — editing
 * or deleting them would change a settled payroll figure. Checks the log's current
 * period and, for an edit that moves the date, the destination period too.
 */
async function assertNotLocked(executorId: string, ...dates: Date[]): Promise<void> {
  const periods = [...new Set(dates.map(periodOf))]
  const locked = await withTenant(async (tx) => {
    for (const p of periods) {
      if (await isPeriodLocked(tx, executorId, p)) return true
    }
    return false
  })
  if (locked) {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'Період закрито виплатою — запис часу заблоковано',
      409
    )
  }
}

const TIMELOG_SELECT = {
  id: true,
  hours: true,
  date: true,
  comment: true,
  executorId: true,
  createdAt: true,
} as const

interface TimeLogRow {
  id: string
  hours: Prisma.Decimal
  date: Date
  comment: string | null
  executorId: string
  createdAt: Date
}

/** Serialize a row: Decimal → number, `date` (DATE col) → 'YYYY-MM-DD'. */
function toDto(row: TimeLogRow) {
  return {
    id: row.id,
    hours: Number(row.hours),
    date: row.date.toISOString().slice(0, 10),
    comment: row.comment,
    executorId: row.executorId,
    createdAt: row.createdAt,
  }
}

/** Load a time log and assert it belongs to the given order (path consistency + IDOR). */
async function loadLogOfOrder(logId: string, orderId: string) {
  const log = await withTenant((tx) =>
    tx.timeLog.findUnique({
      where: { id: logId },
      select: { id: true, orderId: true, executorId: true, date: true },
    })
  )
  if (!log || log.orderId !== orderId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Запис часу не знайдено', 404)
  }
  return log
}

const timeLogsRoute: FastifyPluginAsync = (fastify) => {
  // ── List + total ─────────────────────────────────────────────────────────
  fastify.get<{ Params: { orderId: string } }>(
    '/orders/:orderId/time-logs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await requireTeamOrder(request, request.params.orderId)
      const rows = await withTenant((tx) =>
        tx.timeLog.findMany({
          where: { orderId: request.params.orderId },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          select: TIMELOG_SELECT,
        })
      )
      const logs = rows.map(toDto)
      const totalHours = logs.reduce((sum, l) => sum + l.hours, 0)
      return reply.send({ success: true, data: { logs, totalHours } })
    }
  )

  // ── Create ───────────────────────────────────────────────────────────────
  fastify.post<{ Params: { orderId: string } }>(
    '/orders/:orderId/time-logs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const input = createTimeLogSchema.parse(request.body)
      // A new entry in a period that's already been paid out would desync the payroll.
      await assertNotLocked(request.user.sub, new Date(input.date))

      const row = await withTenant((tx) =>
        tx.timeLog.create({
          data: {
            agency: { connect: { id: agencyId } },
            order: { connect: { id: orderId } },
            executor: { connect: { id: request.user.sub } },
            hours: input.hours,
            date: new Date(input.date),
            comment: input.comment ?? null,
          },
          select: TIMELOG_SELECT,
        })
      )

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'order.time_logged',
        resourceType: 'order',
        resourceId: orderId,
        result: 'allowed',
        metadata: { timeLogId: row.id, hours: input.hours },
      })

      return reply.status(201).send({ success: true, data: { log: toDto(row) } })
    }
  )

  // ── Update (author only) ─────────────────────────────────────────────────
  fastify.patch<{ Params: { orderId: string; logId: string } }>(
    '/orders/:orderId/time-logs/:logId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await requireTeamOrder(request, request.params.orderId)
      const log = await loadLogOfOrder(request.params.logId, request.params.orderId)
      if (log.executorId !== request.user.sub) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Редагувати може лише автор запису', 403)
      }
      const input = updateTimeLogSchema.parse(request.body)
      // Freeze edits once the period is settled (current period + destination if the date moves).
      const dates = [log.date, ...(input.date !== undefined ? [new Date(input.date)] : [])]
      await assertNotLocked(log.executorId, ...dates)

      const data: Prisma.TimeLogUpdateInput = {}
      if (input.hours !== undefined) data.hours = input.hours
      if (input.date !== undefined) data.date = new Date(input.date)
      if (input.comment !== undefined) data.comment = input.comment

      const row = await withTenant((tx) =>
        tx.timeLog.update({
          where: { id: log.id },
          data,
          select: TIMELOG_SELECT,
        })
      )
      return reply.send({ success: true, data: { log: toDto(row) } })
    }
  )

  // ── Delete (author only) ─────────────────────────────────────────────────
  fastify.delete<{ Params: { orderId: string; logId: string } }>(
    '/orders/:orderId/time-logs/:logId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await requireTeamOrder(request, request.params.orderId)
      const log = await loadLogOfOrder(request.params.logId, request.params.orderId)
      if (log.executorId !== request.user.sub) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Видалити може лише автор запису', 403)
      }
      await assertNotLocked(log.executorId, log.date)
      await withTenant((tx) => tx.timeLog.delete({ where: { id: log.id } }))

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'order.time_log_deleted',
        resourceType: 'order',
        resourceId: request.params.orderId,
        result: 'allowed',
        metadata: { timeLogId: log.id },
      })

      return reply.send({ success: true, data: { id: log.id } })
    }
  )

  return Promise.resolve()
}

export default timeLogsRoute
