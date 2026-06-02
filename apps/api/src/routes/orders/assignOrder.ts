import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, assignOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * PATCH /orders/:id/assign — triage: assign an executor to the order (null =
 * unassign). Workspace-only. The assignee must be a member of the order's agency.
 * (Triage "variant B": only the team sees/assigns unassigned orders — list
 * filtering lives in GET /orders.)
 */
const assignOrderRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch<{ Params: { id: string } }>(
    '/orders/:id/assign',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = assignOrderSchema.parse(request.body)
      const user = request.user

      const order = await prisma.order.findUnique({
        where: { id: request.params.id },
        select: { id: true, agencyId: true, deletedAt: true },
      })
      if (!order || order.deletedAt) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      assertSameTenant(user, order.agencyId)

      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Призначення доступне лише команді', 403)
      }

      if (input.assigneeId) {
        // Validate against the ORDER's agency (the resource), not the actor's active
        // agency — these can differ for a multi-agency user (R-3 / Phase 1 IDOR).
        const member = await prisma.agencyMember.findUnique({
          where: { agencyId_profileId: { agencyId: order.agencyId, profileId: input.assigneeId } },
          select: { profileId: true },
        })
        if (!member) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Виконавець не є членом агенції', 400)
        }
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: input.assigneeId
          ? { assignee: { connect: { id: input.assigneeId } } }
          : { assignee: { disconnect: true } },
        select: { id: true, assigneeId: true, updatedAt: true },
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId: order.agencyId,
        action: input.assigneeId ? 'order.assigned' : 'order.unassigned',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { assigneeId: input.assigneeId },
      })

      // notify(orders.assigned) wired in S2-13 (via outbox).
      return reply.send({ success: true, data: { order: updated } })
    }
  )

  return Promise.resolve()
}

export default assignOrderRoute
