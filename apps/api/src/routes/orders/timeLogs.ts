import { type Prisma, prisma } from '@workflo/db'
import { ApiErrorCode, AppError, createTimeLogSchema, updateTimeLogSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'
import { requireTeamOrder } from './access.js'

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
  const log = await prisma.timeLog.findUnique({
    where: { id: logId },
    select: { id: true, orderId: true, executorId: true },
  })
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
      const rows = await prisma.timeLog.findMany({
        where: { orderId: request.params.orderId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: TIMELOG_SELECT,
      })
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

      const row = await prisma.timeLog.create({
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

      const data: Prisma.TimeLogUpdateInput = {}
      if (input.hours !== undefined) data.hours = input.hours
      if (input.date !== undefined) data.date = new Date(input.date)
      if (input.comment !== undefined) data.comment = input.comment

      const row = await prisma.timeLog.update({
        where: { id: log.id },
        data,
        select: TIMELOG_SELECT,
      })
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
      await prisma.timeLog.delete({ where: { id: log.id } })

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
