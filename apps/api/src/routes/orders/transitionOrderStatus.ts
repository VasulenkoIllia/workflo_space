import { type Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  canTransitionOrder,
  INTERNAL_TO_CLIENT_STATUS,
  OrderClientStatus,
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
            requiresApproval: true,
            approvalStatus: true,
            deletedAt: true,
            // 02-В advance gate (hourly_prepaid only): needs the project's model + the
            // client's money-account balance.
            project: { select: { billingModel: true } },
            company: { select: { moneyBalance: true } },
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

      // 02-А: when the order requires estimate approval, work cannot start until the
      // client has approved. approvalStatus is monotonic (only the client moves it to
      // approved/rejected, never back), so the snapshot check is race-free for this gate.
      if (
        to === OrderInternalStatus.IN_PROGRESS &&
        order.requiresApproval &&
        order.approvalStatus !== 'approved'
      ) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Оцінку ще не погоджено клієнтом — старт роботи заблоковано',
          409
        )
      }

      // 02-В advance gate (owner decision: hourly_prepaid only, moneyBalance discipline):
      // a prepaid project bills the advance at cycle start, which drives moneyBalance
      // negative; work on its orders can't start while the client still owes (balance < 0),
      // i.e. the advance is unpaid. Once the advance lands the balance returns to ≥ 0 and the
      // order may start — exactly the «чекаємо аванс» behavior, with no extra schema.
      if (
        to === OrderInternalStatus.IN_PROGRESS &&
        order.project?.billingModel === 'hourly_prepaid' &&
        order.company?.moneyBalance.lessThan(0)
      ) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Очікується аванс — у клієнта непогашений борг, старт роботи заблоковано',
          409
        )
      }

      // 06-ПІДПИС договір-гейт (рішення власника 06.07, тумблер агенції): без
      // ПРИЙНЯТОГО клієнтом договору робота не стартує. Рамкова семантика: будь-який
      // accepted-договір цієї КОМПАНІЇ (не per-order). Внутрішні замовлення без
      // компанії гейт не чіпає.
      if (to === OrderInternalStatus.IN_PROGRESS && order.companyId) {
        const agency = await withTenant((tx) =>
          tx.agency.findUnique({
            where: { id: order.agencyId },
            select: { requireSignedContract: true },
          })
        )
        if (agency?.requireSignedContract) {
          const contract = await withTenant((tx) =>
            tx.document.findFirst({
              where: { companyId: order.companyId ?? '', type: 'contract', status: 'accepted' },
              select: { id: true },
            })
          )
          if (!contract) {
            throw new AppError(
              ApiErrorCode.CONFLICT,
              'Немає прийнятого договору з клієнтом — старт роботи заблоковано (вимога агенції)',
              409
            )
          }
        }
      }

      const isInternal = isInternalTeam(user)
      const isReopen = from === OrderInternalStatus.DONE && to === OrderInternalStatus.REVISION
      const isCompanyOwner =
        user.memberships.find((m) => m.companyId === order.companyId)?.role === 'owner'
      if (!(isInternal || (isReopen && isCompanyOwner))) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недостатньо прав для зміни статусу', 403)
      }

      const data: Prisma.OrderUpdateManyMutationInput = {
        internalStatus: to,
        clientStatus: INTERNAL_TO_CLIENT_STATUS[to],
      }
      // 02-А: while the client's estimate decision is still pending, keep the order visibly
      // «pending_approval» to the client even as the team shuffles internal pre-work states
      // (estimating ↔ clarification both map to in_progress) — don't lose that the client owes
      // a decision. Terminal maps (cancelled) pass through untouched.
      if (
        order.approvalStatus === 'pending' &&
        data.clientStatus === OrderClientStatus.IN_PROGRESS
      ) {
        data.clientStatus = OrderClientStatus.PENDING_APPROVAL
      }
      if (to === OrderInternalStatus.ON_HOLD) data.onHoldReason = input.comment ?? null
      if (to === OrderInternalStatus.CANCELLED) data.cancelledReason = input.comment ?? null

      // Atomic: status update + activity-feed row + outbox notify all commit
      // together, so a delivered notification always reflects a persisted change
      // (and a rolled-back change never notifies).
      const updated = await tenantTransaction(prisma, async (tx) => {
        // AR-13: the state-machine check above ran on a snapshot — re-assert the
        // from-state INSIDE the write (guarded WHERE), so a concurrent transition
        // can't slip an invalid from→to through the gap (TOCTOU).
        const guarded = await tx.order.updateMany({
          where: { id: order.id, internalStatus: from, deletedAt: null },
          data,
        })
        if (guarded.count === 0) {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Статус замовлення щойно змінився — оновіть сторінку і повторіть',
            409
          )
        }
        const u = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
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
