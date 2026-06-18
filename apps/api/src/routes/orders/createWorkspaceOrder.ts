import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, createWorkspaceOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { assertWithinQuota } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * POST /workspace/orders (P-7) — the internal team (owner/executor) creates a task FOR a
 * client, without a client request (proactive work). `companyId` is explicit; the client
 * sees the task in their portal order list (filtered by company, not type). `zeroBilled`
 * is the team's choice (covered by a subscription, or separately billable). No client
 * approval is required — that gate (requiresApproval) is for client-initiated estimates.
 */
const createWorkspaceOrderRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/workspace/orders',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createWorkspaceOrderSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      await assertWithinQuota(agencyId, 'orders')

      const order = await withTenant(async (tx) => {
        // The target company must be in this tenant.
        const company = await tx.company.findFirst({
          where: { id: input.companyId, agencyId },
          select: { id: true },
        })
        if (!company) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }
        // If linked to a project, it must belong to the SAME company.
        if (input.projectId) {
          const project = await tx.project.findFirst({
            where: { id: input.projectId, agencyId, companyId: input.companyId },
            select: { id: true },
          })
          if (!project) {
            throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
          }
        }
        return tx.order.create({
          data: {
            agency: { connect: { id: agencyId } },
            company: { connect: { id: input.companyId } },
            createdBy: { connect: { id: user.sub } },
            ...(input.projectId ? { project: { connect: { id: input.projectId } } } : {}),
            title: input.title,
            description: input.description ?? null,
            type: input.type,
            priority: input.priority,
            zeroBilled: input.zeroBilled,
            internalStatus: 'new',
            clientStatus: 'in_progress',
            deadline: input.dueDate ? new Date(input.dueDate) : null,
          },
          select: {
            id: true,
            title: true,
            companyId: true,
            type: true,
            zeroBilled: true,
            projectId: true,
            priority: true,
            internalStatus: true,
            clientStatus: true,
            deadline: true,
            createdAt: true,
          },
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'order.created_internal',
        resourceType: 'order',
        resourceId: order.id,
        result: 'allowed',
        metadata: { companyId: input.companyId, type: input.type, zeroBilled: input.zeroBilled },
      })

      return reply.status(201).send({ success: true, data: { order } })
    }
  )

  return Promise.resolve()
}

export default createWorkspaceOrderRoute
