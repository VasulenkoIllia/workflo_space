import { type Prisma, prisma } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  createInternalTaskSchema,
  updateInternalTaskSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
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
} as const

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
  const task = await prisma.internalTask.findUnique({
    where: { id: taskId },
    select: { id: true, orderId: true },
  })
  if (!task || task.orderId !== orderId) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Задачу не знайдено', 404)
  }
  return task
}

const internalTasksRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { orderId: string } }>(
    '/orders/:orderId/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await requireTeamOrder(request, request.params.orderId)
      const tasks = await prisma.internalTask.findMany({
        where: { orderId: request.params.orderId },
        orderBy: { position: 'asc' },
        select: TASK_SELECT,
      })
      return reply.send({ success: true, data: { tasks } })
    }
  )

  fastify.post<{ Params: { orderId: string } }>(
    '/orders/:orderId/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId } = await requireTeamOrder(request, request.params.orderId)
      const input = createInternalTaskSchema.parse(request.body)
      if (input.assigneeId) await assertAgencyMember(agencyId, input.assigneeId)

      const task = await prisma.internalTask.create({
        data: {
          order: { connect: { id: request.params.orderId } },
          title: input.title,
          position: input.position ?? 0,
          ...(input.assigneeId ? { assignee: { connect: { id: input.assigneeId } } } : {}),
        },
        select: TASK_SELECT,
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'order.task_created',
        resourceType: 'order',
        resourceId: request.params.orderId,
        result: 'allowed',
        metadata: { taskId: task.id },
      })

      return reply.status(201).send({ success: true, data: { task } })
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

      const task = await prisma.internalTask.update({
        where: { id: request.params.taskId },
        data,
        select: TASK_SELECT,
      })
      return reply.send({ success: true, data: { task } })
    }
  )

  fastify.delete<{ Params: { orderId: string; taskId: string } }>(
    '/orders/:orderId/tasks/:taskId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await requireTeamOrder(request, request.params.orderId)
      await loadTaskOfOrder(request.params.taskId, request.params.orderId)
      await prisma.internalTask.delete({ where: { id: request.params.taskId } })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
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
