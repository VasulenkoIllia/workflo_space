import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, decideOrderApprovalSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { enqueueOutbox } from '../../services/outbox.js'

/**
 * POST /portal/orders/:id/approval (02-А) — the client decides on the estimate the team
 * submitted. Only the order's company OWNER may decide (DESIGN_TZ §1168: «лише client-owner»).
 * approve → approvalStatus=approved (the → in_progress gate opens); reject → approvalStatus=
 * rejected with the client's reason, back to the team. Both clear pending_approval. Idempotent
 * guard: only an order awaiting a decision (approvalStatus=pending) can be decided.
 */
const decideOrderApprovalRoute: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/portal/orders/:id/approval',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = decideOrderApprovalSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)

      const order = await withTenant((tx) =>
        tx.order.findFirst({
          where: { id: request.params.id, agencyId, deletedAt: null },
          select: { id: true, companyId: true, approvalStatus: true },
        })
      )
      if (!order) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
      }
      // Decision is a CLIENT action: the caller must be a member of THIS order's company
      // (internal team has no such membership → cannot self-approve), and either the owner
      // or a designated contact with can_approve_estimates (DESIGN_TZ §1168, can.ts gate).
      const membership =
        order.companyId != null
          ? user.memberships.find((m) => m.companyId === order.companyId)
          : undefined
      const canDecide =
        membership != null &&
        (membership.role === 'owner' || membership.permissions?.can_approve_estimates === true)
      if (!canDecide) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Погоджувати оцінку може лише власник або уповноважений контакт',
          403
        )
      }
      if (order.approvalStatus !== 'pending') {
        throw new AppError(ApiErrorCode.CONFLICT, 'Немає оцінки, що очікує погодження', 409)
      }

      const approved = input.decision === 'approve'
      const comment = input.comment?.trim() || null

      const updated = await tenantTransaction(prisma, async (tx) => {
        // Guard on pending: a concurrent decision (or re-submit) can't be double-applied.
        const guarded = await tx.order.updateMany({
          where: { id: order.id, deletedAt: null, approvalStatus: 'pending' },
          data: {
            approvalStatus: approved ? 'approved' : 'rejected',
            approvalDecidedAt: new Date(),
            approvalDecidedById: user.sub,
            approvalComment: comment,
            // Either way the order is no longer pending the client's input.
            clientStatus: 'in_progress',
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
            approvalStatus: true,
            approvalDecidedAt: true,
            approvalComment: true,
            clientStatus: true,
            updatedAt: true,
          },
        })
        await tx.activityLog.create({
          data: {
            agencyId,
            orderId: order.id,
            actorId: user.sub,
            action: approved ? 'approval_approved' : 'approval_rejected',
            metadata: { comment },
          },
        })
        await enqueueOutbox(tx, {
          type: approved ? 'order.approval_approved' : 'order.approval_rejected',
          payload: { orderId: order.id, actorId: user.sub, comment },
          agencyId,
        })
        return u
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: approved ? 'order.approval_approved' : 'order.approval_rejected',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { comment },
      })

      return reply.send({ success: true, data: { order: updated } })
    }
  )

  return Promise.resolve()
}

export default decideOrderApprovalRoute
