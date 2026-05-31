import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, createOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'

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

      const order = await prisma.order.create({
        data: {
          agency: { connect: { id: agencyId } },
          company: { connect: { id: companyId } },
          createdBy: { connect: { id: user.sub } },
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          priority: input.priority,
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
