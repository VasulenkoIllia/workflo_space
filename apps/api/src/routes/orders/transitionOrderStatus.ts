import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  canTransitionOrder,
  INTERNAL_TO_CLIENT_STATUS,
  OrderInternalStatus,
  transitionOrderStatusSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { enqueueOutbox } from '../../services/outbox.js'

/**
 * PATCH /orders/:id/status — internal status transition, validated against the
 * canonical state machine (canTransitionOrder) and mirrored to clientStatus.
 * Internal team may run any valid transition; a client may ONLY reopen their own
 * company's order (done → revision) and only as the company owner.
 */
const transitionOrderStatusRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch<{ Params: { id: string } }>(
    '/orders/:id/status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = transitionOrderStatusSchema.parse(request.body)
      const user = request.user

      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: request.params.id },
          select: {
            id: true,
            agencyId: true,
            companyId: true,
            internalStatus: true,
            deletedAt: true,
          },
        })
      )
      if (!order || order.deletedAt) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      assertSameTenant(user, order.agencyId)

      // Prisma's generated enum is structurally identical to @workflo/types' but
      // nominally distinct — cast to the shared type for the state-machine check.
      const from = order.internalStatus as OrderInternalStatus
      const to = input.status
      if (!canTransitionOrder(from, to)) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          `Недопустимий перехід статусу: ${from} → ${to}`,
          409
        )
      }

      const isInternal = isInternalTeam(user)
      const isReopen = from === OrderInternalStatus.DONE && to === OrderInternalStatus.REVISION
      const isCompanyOwner =
        user.memberships.find((m) => m.companyId === order.companyId)?.role === 'owner'
      if (!(isInternal || (isReopen && isCompanyOwner))) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недостатньо прав для зміни статусу', 403)
      }

      const data: Prisma.OrderUpdateInput = {
        internalStatus: to,
        clientStatus: INTERNAL_TO_CLIENT_STATUS[to],
      }
      if (to === OrderInternalStatus.ON_HOLD) data.onHoldReason = input.comment ?? null
      if (to === OrderInternalStatus.CANCELLED) data.cancelledReason = input.comment ?? null

      // Atomic: status update + activity-feed row + outbox notify all commit
      // together, so a delivered notification always reflects a persisted change
      // (and a rolled-back change never notifies).
      const updated = await tenantTransaction(prisma, async (tx) => {
        const u = await tx.order.update({
          where: { id: order.id },
          data,
          select: {
            id: true,
            internalStatus: true,
            clientStatus: true,
            onHoldReason: true,
            cancelledReason: true,
            updatedAt: true,
          },
        })
        await tx.activityLog.create({
          data: {
            agencyId: order.agencyId, // S-D3: stamp tenant on the activity row
            orderId: order.id,
            actorId: user.sub,
            action: 'status_changed',
            metadata: { from, to, comment: input.comment ?? null },
          },
        })
        await enqueueOutbox(tx, {
          type: 'order.status_changed',
          payload: {
            orderId: order.id,
            from,
            to,
            actorId: user.sub,
            comment: input.comment ?? null,
          },
          agencyId: order.agencyId,
        })
        return u
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId: order.agencyId,
        action: 'order.status_changed',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { from, to, comment: input.comment ?? null },
      })

      return reply.send({ success: true, data: { order: updated } })
    }
  )

  return Promise.resolve()
}

export default transitionOrderStatusRoute
