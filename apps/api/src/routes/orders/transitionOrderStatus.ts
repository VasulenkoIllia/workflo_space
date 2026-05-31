import { type Prisma, prisma } from '@workflo/db'
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
import { writeAuditAsync } from '../../services/audit.js'

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

      const order = await prisma.order.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          agencyId: true,
          companyId: true,
          internalStatus: true,
          deletedAt: true,
        },
      })
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

      const isInternal = user.role === 'executor'
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

      const updated = await prisma.order.update({
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

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.status_changed',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { from, to, comment: input.comment ?? null },
      })

      // notify(orders.status_changed) is wired in S2-13 (via the outbox).
      return reply.send({ success: true, data: { order: updated } })
    }
  )

  return Promise.resolve()
}

export default transitionOrderStatusRoute
