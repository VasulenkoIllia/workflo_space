import { type Prisma, prisma, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  createInternalTaskSchema,
  updateInternalTaskSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { requireTeamOrder } from './access.js'

const TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  assigneeId: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true } },
  // мультивиконавці задачі: співвиконавці ДОДАТКОВО до головного assigneeId
  coAssignees: {
    select: { profile: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} as const

/** Flatten the coAssignees join rows to plain profiles for the client DTO. */
function serializeTask<T extends { coAssignees: Array<{ profile: { id: string; name: string } }> }>(
  task: T
): Omit<T, 'coAssignees'> & { coAssignees: Array<{ id: string; name: string }> } {
  const { coAssignees, ...rest } = task
  return { ...rest, coAssignees: coAssignees.map((c) => c.profile) }
}

async function assertAgencyMember(agencyId: string, profileId: string): Promise<void> {
  const m = await prisma.agencyMember.findUnique({
    where: { agencyId_profileId: { agencyId, profileId } },
    select: { profileId: true },
  })
  if (!m) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Виконавець не є членом агенції', 400)
  }
}

/** Ensure the task exists AND belongs to the given order (path consistency + IDOR). */
async function loadTaskOfOrder(taskId: string, orderId: string) {
  const task = await withTenant((tx) =>
    tx.internalTask.findUnique({
      where: { id: taskId },
      select: { id: true, orderId: true },
    })
  )
  if (!task || task.orderId !== orderId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Задачу не знайдено', 404)
  }
  return task
}

const BOARD_SELECT = {
  id: true,
  title: true,
  status: true,
  assigneeId: true,
  position: true,
  updatedAt: true,
  order: { select: { id: true, title: true, estimatedHours: true } },
  assignee: { select: { id: true, name: true } },
  coAssignees: {
    select: { profile: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} as const

const boardQuerySchema = z.object({
  assigneeId: z.string().min(1).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
})

const internalTasksRoute: FastifyPluginAsync = (fastify) => {
  // ── Global task board (02-Е / workspace-board.jsx, фінд.#8) — all tasks across the
  // agency's orders. Internal team (DnD moves reuse the per-order PATCH, which the board
  // calls with each task's own orderId). Optional assignee/status filters. ──────────────
  fastify.get(
    '/workspace/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const q = boardQuerySchema.parse(request.query)
      const tasks = await withTenant(async (tx) => {
        const rows = await tx.internalTask.findMany({
          where: {
            agencyId,
            ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
            ...(q.status ? { status: q.status } : {}),
          },
          orderBy: [{ status: 'asc' }, { position: 'asc' }, { updatedAt: 'desc' }],
          select: BOARD_SELECT,
        })
        // Per-order logged hours for the est-vs-actual mini-bar on the cards. Hours
        // live on the ORDER (TimeLog has no task link — see workspace-board-task.jsx
        // rollup canon), so every card of an order shares its bar. Finalized entries
        // only — a running timer's hours aren't final yet (same rule as hoursReport).
        const orderIds = [...new Set(rows.map((t) => t.order.id))]
        const sums = orderIds.length
          ? await tx.timeLog.groupBy({
              by: ['orderId'],
              where: {
                agencyId,
                orderId: { in: orderIds },
                OR: [{ startedAt: null }, { endedAt: { not: null } }],
              },
              _sum: { hours: true },
            })
          : []
        const loggedByOrder = new Map(sums.map((s) => [s.orderId, Number(s._sum.hours ?? 0)]))
        return rows.map((t) => ({
          ...serializeTask(t),
          order: {
            id: t.order.id,
            title: t.order.title,
            estimatedHours: t.order.estimatedHours != null ? Number(t.order.estimatedHours) : null,
            loggedHours: loggedByOrder.get(t.order.id) ?? 0,
          },
        }))
      })
      return reply.send({ success: true, data: { tasks } })
    }
  )

  fastify.get<{ Params: { orderId: string } }>(
    '/orders/:orderId/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await requireTeamOrder(request, request.params.orderId)
      const tasks = await withTenant((tx) =>
        tx.internalTask.findMany({
          where: { orderId: request.params.orderId },
          orderBy: { position: 'asc' },
          select: TASK_SELECT,
        })
      )
      return reply.send({ success: true, data: { tasks: tasks.map(serializeTask) } })
    }
  )

  fastify.post<{ Params: { orderId: string } }>(
    '/orders/:orderId/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId } = await requireTeamOrder(request, request.params.orderId)
      const input = createInternalTaskSchema.parse(request.body)
      if (input.assigneeId) await assertAgencyMember(agencyId, input.assigneeId)

      const task = await withTenant((tx) =>
        tx.internalTask.create({
          data: {
            order: { connect: { id: request.params.orderId } },
            agency: { connect: { id: agencyId } }, // S-D3: stamp tenant on new tasks
            title: input.title,
            position: input.position ?? 0,
            ...(input.assigneeId ? { assignee: { connect: { id: input.assigneeId } } } : {}),
          },
          select: TASK_SELECT,
        })
      )

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.task_created',
        resourceType: 'order',
        resourceId: request.params.orderId,
        result: 'allowed',
        metadata: { taskId: task.id },
      })

      return reply.status(201).send({ success: true, data: { task: serializeTask(task) } })
    }
  )

  fastify.patch<{ Params: { orderId: string; taskId: string } }>(
    '/orders/:orderId/tasks/:taskId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId } = await requireTeamOrder(request, request.params.orderId)
      await loadTaskOfOrder(request.params.taskId, request.params.orderId)
      const input = updateInternalTaskSchema.parse(request.body)
      if (input.assigneeId) await assertAgencyMember(agencyId, input.assigneeId)

      const data: Prisma.InternalTaskUpdateInput = {}
      if (input.title !== undefined) data.title = input.title
      if (input.status !== undefined) data.status = input.status
      if (input.position !== undefined) data.position = input.position
      if (input.assigneeId !== undefined) {
        data.assignee = input.assigneeId
          ? { connect: { id: input.assigneeId } }
          : { disconnect: true }
      }

      const task = await withTenant((tx) =>
        tx.internalTask.update({
          where: { id: request.params.taskId },
          data,
          select: TASK_SELECT,
        })
      )
      return reply.send({ success: true, data: { task: serializeTask(task) } })
    }
  )

  fastify.delete<{ Params: { orderId: string; taskId: string } }>(
    '/orders/:orderId/tasks/:taskId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId } = await requireTeamOrder(request, request.params.orderId)
      await loadTaskOfOrder(request.params.taskId, request.params.orderId)
      await withTenant((tx) => tx.internalTask.delete({ where: { id: request.params.taskId } }))

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.task_deleted',
        resourceType: 'order',
        resourceId: request.params.orderId,
        result: 'allowed',
        metadata: { taskId: request.params.taskId },
      })

      return reply.send({ success: true, data: { id: request.params.taskId } })
    }
  )

  return Promise.resolve()
}

export default internalTasksRoute
