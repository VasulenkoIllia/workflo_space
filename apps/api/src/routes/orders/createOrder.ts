import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { assertWithinQuota } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'
import { slaDueDates } from '../../services/sla.js'
import { enqueueOutbox } from '../../services/outbox.js'

/**
 * POST /orders — a client creates an order for their active company.
 * Tenant-stamped from the session (ADR-004): agencyId/companyId are never taken
 * from the request body. internalStatus starts at `new` (triage in S2-03).
 */
const createOrderRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/orders',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 60, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const input = createOrderSchema.parse(request.body)
      const user = request.user

      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      const agencyId = requireActiveAgency(user)

      // Member of the company (or internal team) may create. Tenant-guarded by agencyId.
      if (!can(user, 'order.create', { companyId, agencyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недостатньо прав для створення замовлення', 403)
      }
      // SaaS quota seam (no-op Phase 0; per-plan limit Phase 1) — SAAS.md F2 / ADR-007.
      await assertWithinQuota(agencyId, 'orders')

      const order = await withTenant(async (tx) => {
        // S10-02: SLA-дедлайни з політики агенції для цього пріоритету (нема політики → null)
        const sla = await slaDueDates(tx, agencyId, input.priority)
        const created = await tx.order.create({
          data: {
            agency: { connect: { id: agencyId } },
            company: { connect: { id: companyId } },
            createdBy: { connect: { id: user.sub } },
            title: input.title,
            description: input.description ?? null,
            type: input.type,
            priority: input.priority,
            ...sla,
            internalStatus: 'new',
            clientStatus: 'in_progress',
            deadline: input.dueDate ? new Date(input.dueDate) : null,
            ...(input.stages?.length
              ? {
                  stages: {
                    create: input.stages.map((s, i) => ({
                      title: s.title,
                      description: s.description ?? null,
                      position: i + 1,
                    })),
                  },
                }
              : {}),
          },
          select: {
            id: true,
            title: true,
            description: true,
            clientStatus: true,
            priority: true,
            deadline: true,
            createdAt: true,
            updatedAt: true,
          },
        })
        // Notify the agency team a new order landed.
        await enqueueOutbox(tx, {
          type: 'order.created',
          payload: { orderId: created.id, actorId: user.sub },
          agencyId,
        })
        return created
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'order.created',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { companyId, agencyId },
      })

      return reply.status(201).send({
        success: true,
        data: {
          order: {
            id: order.id,
            title: order.title,
            description: order.description,
            clientStatus: order.clientStatus,
            priority: order.priority,
            dueDate: order.deadline,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          },
        },
      })
    }
  )

  return Promise.resolve()
}

export default createOrderRoute
