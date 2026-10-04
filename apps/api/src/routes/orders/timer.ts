import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { getActiveTimer, startTimer, stopTimer } from '../../services/timer.js'
import { requireTeamOrder } from './access.js'

const startSchema = z.object({ orderId: z.string().min(1) })

type TimerRow = {
  id: string
  orderId: string
  hours: Prisma.Decimal
  startedAt: Date | null
  endedAt: Date | null
  date: Date
  comment: string | null
  executorId: string
  order: { id: string; title: string } | null
}

function toDto(t: TimerRow | null) {
  if (!t) return null
  return {
    id: t.id,
    orderId: t.orderId,
    hours: Number(t.hours),
    startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    endedAt: t.endedAt ? t.endedAt.toISOString() : null,
    date: t.date.toISOString().slice(0, 10),
    comment: t.comment,
    executorId: t.executorId,
    order: t.order,
  }
}

/** Internal-team only (incl. manager — time tracking isn't finance-gated, like time-logs). */
function assertTeam(user: Parameters<typeof requireActiveAgency>[0]): string {
  const agencyId = requireActiveAgency(user)
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
  }
  return agencyId
}

/** Time-tracking timer (02-orders T2). One running timer per executor; start auto-stops the
 * previous; the 8h auto-stop lives in cron C15 (cron/timerAutoStop). */
const timerRoute: FastifyPluginAsync = (fastify) => {
  // ── Current running timer (or null) ───────────────────────────────────────────
  fastify.get(
    '/workspace/timer',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const timer = await withTenant((tx) => getActiveTimer(tx, agencyId, request.user.sub))
      return reply.send({ success: true, data: { timer: toDto(timer) } })
    }
  )

  // ── Start on an order (auto-stops any running one) ─────────────────────────────
  fastify.post(
    '/workspace/timer/start',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orderId } = startSchema.parse(request.body)
      // Validates the order is in the caller's tenant + the caller is internal team.
      const { agencyId, orderId: validOrderId } = await requireTeamOrder(request, orderId)
      const now = new Date()
      const timer = await tenantTransaction(prisma, (tx) =>
        startTimer(tx, { agencyId, executorId: request.user.sub, orderId: validOrderId, now })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.timer_started',
        resourceType: 'order',
        resourceId: validOrderId,
        result: 'allowed',
        metadata: { timeLogId: timer.id },
      })
      return reply.status(201).send({ success: true, data: { timer: toDto(timer) } })
    }
  )

  // ── Stop the running timer (no-op → null if none) ──────────────────────────────
  fastify.post(
    '/workspace/timer/stop',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertTeam(request.user)
      const now = new Date()
      const timer = await tenantTransaction(prisma, (tx) =>
        stopTimer(tx, { agencyId, executorId: request.user.sub, now })
      )
      if (timer) {
        writeAuditAsync(request.log, {
          actorId: request.user.sub,
          agencyId,
          action: 'order.timer_stopped',
          resourceType: 'order',
          resourceId: timer.orderId,
          result: 'allowed',
          metadata: { timeLogId: timer.id, hours: Number(timer.hours) },
        })
      }
      return reply.send({ success: true, data: { timer: toDto(timer) } })
    }
  )

  return Promise.resolve()
}

export default timerRoute
