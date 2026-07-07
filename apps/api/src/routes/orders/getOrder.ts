import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

/** Prisma Decimal → JSON number (Decimal.toJSON() emits a string otherwise). */
const num = (d: unknown): number | null => (d == null ? null : Number(d))

/**
 * GET /orders/:id — order detail. Client view hides internal fields (status,
 * assignee, pricing internals); internal team (executor) sees everything.
 * Tenant-guarded (ADR-004) + client IDOR check (must belong to the order's
 * company; otherwise 404 to avoid leaking existence within the tenant).
 */
const getOrderRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const notFound = () => new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)

      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: request.params.id },
          select: {
            id: true,
            agencyId: true,
            companyId: true,
            title: true,
            description: true,
            type: true,
            priority: true,
            internalStatus: true,
            clientStatus: true,
            billingType: true,
            nomenclatureId: true,
            fixedPrice: true,
            hourlyRate: true,
            estimatedHours: true,
            totalAmount: true,
            currency: true,
            deadline: true,
            paidAt: true,
            deletedAt: true,
            onHoldReason: true,
            cancelledReason: true,
            requiresApproval: true,
            approvalStatus: true,
            approvalDecidedAt: true,
            approvalComment: true,
            createdAt: true,
            updatedAt: true,
            company: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
            project: { select: { id: true, name: true, billingModel: true } },
            tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
            firstResponseDueAt: true,
            resolutionDueAt: true,
            firstRespondedAt: true,
            slaBreachedAt: true,
            stages: {
              select: { id: true, title: true, description: true, status: true, position: true },
              orderBy: { position: 'asc' },
            },
          },
        })
      )

      if (!order || order.deletedAt) throw notFound()
      assertSameTenant(user, order.agencyId)

      const isInternal = isInternalTeam(user)
      if (!isInternal && !user.memberships.some((m) => m.companyId === order.companyId)) {
        throw notFound() // same tenant, different company → hide
      }

      const clientView = {
        id: order.id,
        title: order.title,
        description: order.description,
        clientStatus: order.clientStatus,
        priority: order.priority,
        totalAmount: num(order.totalAmount),
        currency: order.currency,
        dueDate: order.deadline,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        stages: order.stages,
        // 02-А: the portal renders the approval block + audit row from these.
        requiresApproval: order.requiresApproval,
        approvalStatus: order.approvalStatus,
        approvalDecidedAt: order.approvalDecidedAt,
        approvalComment: order.approvalComment,
      }

      if (!isInternal) {
        return reply.send({ success: true, data: { order: clientView } })
      }

      return reply.send({
        success: true,
        data: {
          order: {
            ...clientView,
            internalStatus: order.internalStatus,
            type: order.type,
            billingType: order.billingType,
            nomenclatureId: order.nomenclatureId,
            fixedPrice: num(order.fixedPrice),
            hourlyRate: num(order.hourlyRate),
            estimatedHours: num(order.estimatedHours),
            paidAt: order.paidAt,
            onHoldReason: order.onHoldReason,
            cancelledReason: order.cancelledReason,
            company: order.company,
            assignee: order.assignee,
            project: order.project,
            tags: order.tags.map((t) => t.tag),
            firstResponseDueAt: order.firstResponseDueAt,
            resolutionDueAt: order.resolutionDueAt,
            firstRespondedAt: order.firstRespondedAt,
            slaBreachedAt: order.slaBreachedAt,
          },
        },
      })
    }
  )

  return Promise.resolve()
}

export default getOrderRoute
