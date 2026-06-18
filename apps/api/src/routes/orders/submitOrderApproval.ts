import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  OrderInternalStatus,
  submitOrderApprovalSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { enqueueOutbox } from '../../services/outbox.js'

// 02-А: only pre-work states make sense to send for estimate approval.
const SUBMITTABLE: readonly OrderInternalStatus[] = [
  OrderInternalStatus.NEW,
  OrderInternalStatus.CLARIFICATION,
  OrderInternalStatus.ESTIMATING,
]

/**
 * POST /workspace/orders/:id/submit-approval (02-А) — the team sends the order's estimate
 * to the client for approval. Marks the order `requiresApproval` and moves it to
 * approvalStatus=pending / clientStatus=pending_approval; the → in_progress gate then holds
 * until the client approves (see transitionOrderStatus). There must be something to approve
 * (fixed → a price; hourly → a rate + an hours estimate). Re-submitting a previously
 * rejected estimate is allowed (resets to pending); an already-approved order is rejected.
 */
const submitOrderApprovalRoute: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/workspace/orders/:id/submit-approval',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = submitOrderApprovalSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }

      const order = await withTenant((tx) =>
        tx.order.findFirst({
          where: { id: request.params.id, agencyId, deletedAt: null },
          select: {
            id: true,
            internalStatus: true,
            approvalStatus: true,
            billingType: true,
            fixedPrice: true,
            hourlyRate: true,
            estimatedHours: true,
          },
        })
      )
      if (!order) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      if (order.approvalStatus === 'approved') {
        throw new AppError(ApiErrorCode.CONFLICT, 'Оцінку вже погоджено', 409)
      }
      if (!SUBMITTABLE.includes(order.internalStatus as OrderInternalStatus)) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Подати оцінку на погодження можна лише до старту роботи',
          409
        )
      }
      // Something must be there to approve (05-А: fixed → сума; hourly → ставка + год).
      const hasEstimate =
        order.fixedPrice != null || (order.hourlyRate != null && order.estimatedHours != null)
      if (!hasEstimate) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Спершу виставте оцінку (суму або ставку + години)',
          400
        )
      }

      const updated = await tenantTransaction(prisma, async (tx) => {
        // Guard on the read state: don't clobber an approval that landed concurrently.
        const guarded = await tx.order.updateMany({
          where: {
            id: order.id,
            deletedAt: null,
            approvalStatus: order.approvalStatus, // pending | rejected | null
            internalStatus: { in: [...SUBMITTABLE] }, // can't flip an already-started order
          },
          data: {
            requiresApproval: true,
            approvalStatus: 'pending',
            clientStatus: 'pending_approval',
            approvalDecidedAt: null,
            approvalDecidedById: null,
            approvalComment: null,
          },
        })
        if (guarded.count === 0) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Стан погодження щойно змінився — оновіть сторінку',
            409
          )
        }
        const u = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          select: {
            id: true,
            requiresApproval: true,
            approvalStatus: true,
            clientStatus: true,
            updatedAt: true,
          },
        })
        await tx.activityLog.create({
          data: {
            agencyId,
            orderId: order.id,
            actorId: user.sub,
            action: 'approval_requested',
            metadata: { note: input.note ?? null },
          },
        })
        await enqueueOutbox(tx, {
          type: 'order.approval_requested',
          payload: { orderId: order.id, actorId: user.sub, note: input.note ?? null },
          agencyId,
        })
        return u
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'order.approval_requested',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { note: input.note ?? null },
      })

      return reply.send({ success: true, data: { order: updated } })
    }
  )

  return Promise.resolve()
}

export default submitOrderApprovalRoute
