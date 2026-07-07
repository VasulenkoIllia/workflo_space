import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { dispatchNotification } from '../../services/notifications.js'
import { requireTeamOrder } from './access.js'

/**
 * МУЛЬТИВИКОНАВЦІ (рішення власника 07.07): співвиконавці ДОДАТКОВО до головного
 * (Order.assigneeId / InternalTask.assigneeId лишаються «відповідальним»). PUT замінює
 * повний список співвиконавців (валідуються як члени агенції). Доданим — notify
 * orders.assigned. Час засікає будь-який член команди незалежно (TimeLog per-executor).
 */
const putSchema = z.object({ profileIds: z.array(z.string().uuid()).max(20) }).strict()

/** Спільна валідація: усі profileIds — члени агенції ресурсу. */
async function assertAgencyMembers(agencyId: string, profileIds: string[]): Promise<void> {
  if (profileIds.length === 0) return
  const members = await withTenant((tx) =>
    tx.agencyMember.findMany({
      where: { agencyId, profileId: { in: profileIds } },
      select: { profileId: true },
    })
  )
  const valid = new Set(members.map((m) => m.profileId))
  if (profileIds.some((id) => !valid.has(id))) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Виконавець не є членом агенції', 400)
  }
}

const coAssigneesRoute: FastifyPluginAsync = (fastify) => {
  // ─── Співвиконавці замовлення ────────────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>(
    '/orders/:id/assignees',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Призначення доступне лише команді', 403)
      }
      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: request.params.id },
          select: { id: true, agencyId: true, title: true, assigneeId: true, deletedAt: true },
        })
      )
      if (!order || order.deletedAt) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      assertSameTenant(user, order.agencyId)
      const body = putSchema.parse(request.body)
      // головного не дублюємо у співвиконавцях
      const wanted = [...new Set(body.profileIds)].filter((id) => id !== order.assigneeId)
      await assertAgencyMembers(order.agencyId, wanted)

      const added = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.orderAssignee.findMany({
          where: { orderId: order.id },
          select: { profileId: true },
        })
        const before = new Set(existing.map((e) => e.profileId))
        await tx.orderAssignee.deleteMany({
          where: { orderId: order.id, profileId: { notIn: wanted.length ? wanted : ['__none__'] } },
        })
        const toAdd = wanted.filter((id) => !before.has(id))
        if (toAdd.length > 0) {
          await tx.orderAssignee.createMany({
            data: toAdd.map((profileId) => ({
              agencyId: order.agencyId,
              orderId: order.id,
              profileId,
            })),
          })
        }
        return toAdd
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId: order.agencyId,
        action: 'order.coassignees_updated',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { count: wanted.length },
      })
      const portalUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
      for (const profileId of added) {
        dispatchNotification(request.log, {
          profileId,
          event: 'orders.assigned',
          vars: { orderTitle: order.title, orderUrl: `${portalUrl}/orders/${order.id}` },
          inApp: { title: 'Вас додано виконавцем', body: order.title },
        })
      }
      return reply.send({ success: true, data: { coAssigneeIds: wanted } })
    }
  )

  // ─── Співвиконавці задачі (InternalTask) ─────────────────────────────────────
  fastify.put<{ Params: { orderId: string; taskId: string } }>(
    '/orders/:orderId/tasks/:taskId/assignees',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId } = await requireTeamOrder(request, request.params.orderId)
      const task = await withTenant((tx) =>
        tx.internalTask.findFirst({
          where: { id: request.params.taskId, orderId: request.params.orderId, agencyId },
          select: { id: true, title: true, assigneeId: true },
        })
      )
      if (!task) throw new AppError(ApiErrorCode.NOT_FOUND, 'Задачу не знайдено', 404)
      const body = putSchema.parse(request.body)
      const wanted = [...new Set(body.profileIds)].filter((id) => id !== task.assigneeId)
      await assertAgencyMembers(agencyId, wanted)

      const added = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.internalTaskAssignee.findMany({
          where: { taskId: task.id },
          select: { profileId: true },
        })
        const before = new Set(existing.map((e) => e.profileId))
        await tx.internalTaskAssignee.deleteMany({
          where: { taskId: task.id, profileId: { notIn: wanted.length ? wanted : ['__none__'] } },
        })
        const toAdd = wanted.filter((id) => !before.has(id))
        if (toAdd.length > 0) {
          await tx.internalTaskAssignee.createMany({
            data: toAdd.map((profileId) => ({ agencyId, taskId: task.id, profileId })),
          })
        }
        return toAdd
      })

      const portalUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
      for (const profileId of added) {
        dispatchNotification(request.log, {
          profileId,
          event: 'orders.assigned',
          vars: {
            orderTitle: task.title,
            orderUrl: `${portalUrl}/orders/${request.params.orderId}`,
          },
          inApp: { title: 'Вас додано виконавцем задачі', body: task.title },
        })
      }
      return reply.send({ success: true, data: { coAssigneeIds: wanted } })
    }
  )

  return Promise.resolve()
}

export default coAssigneesRoute
