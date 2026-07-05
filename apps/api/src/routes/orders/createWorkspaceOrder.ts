import { withTenant } from '@workflo/db'
import { ApiErrorCode, ApprovalMode, AppError, createWorkspaceOrderSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { assertWithinQuota } from '../../saas/limits.js'
import { resolveApprovalMode } from '../../services/approvalPolicy.js'
import { writeAuditAsync } from '../../services/audit.js'
import { slaDueDates } from '../../services/sla.js'
import { enqueueOutbox } from '../../services/outbox.js'

/**
 * POST /workspace/orders (P-7) — the internal team (owner/executor) creates a task FOR a
 * client, without a client request (proactive work). `companyId` is explicit; the client
 * sees the task in their portal order list (filtered by company, not type). `zeroBilled`
 * is the team's choice (covered by a subscription, or separately billable). 02-А approval
 * is off by default here, but the team may opt in (`requiresApproval`) or inherit the
 * linked project's default — the gate then blocks → in_progress until the client approves.
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

      // P-11: agency-tier floor of the approval cascade (non-null).
      const agency = await withTenant((tx) =>
        tx.agency.findUniqueOrThrow({
          where: { id: agencyId },
          select: { defaultApprovalMode: true },
        })
      )

      const order = await withTenant(async (tx) => {
        // The target company must be in this tenant. Its approvalMode is a cascade tier.
        const company = await tx.company.findFirst({
          where: { id: input.companyId, agencyId },
          select: { id: true, approvalMode: true, invoiceApprover: true },
        })
        if (!company) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        }
        // If linked to a project, it must belong to the SAME company. Its approvalMode (or the
        // legacy requiresApproval boolean) is the next cascade tier below an explicit override.
        let projectPolicy: {
          approvalMode: ApprovalMode | null
          requiresApproval: boolean | null
        } | null = null
        if (input.projectId) {
          const project = await tx.project.findFirst({
            where: { id: input.projectId, agencyId, companyId: input.companyId },
            select: { id: true, approvalMode: true, requiresApproval: true },
          })
          if (!project) {
            throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
          }
          projectPolicy = {
            approvalMode: project.approvalMode as ApprovalMode | null,
            requiresApproval: project.requiresApproval,
          }
        }
        // P-11 cascade: explicit override (incl. legacy requiresApproval) → project → company →
        // agency floor. requiresApproval stays = (mode == upfront) so the live 02-А gate is unchanged.
        const orderOverride =
          input.approvalMode ??
          (input.requiresApproval === true
            ? ApprovalMode.UPFRONT
            : input.requiresApproval === false
              ? ApprovalMode.NONE
              : undefined)
        const approvalMode = resolveApprovalMode({
          orderOverride,
          project: projectPolicy,
          company: { approvalMode: company.approvalMode as ApprovalMode | null },
          agencyDefault: agency.defaultApprovalMode as ApprovalMode,
        })
        const requiresApproval = approvalMode === ApprovalMode.UPFRONT
        // S10-02: SLA-дедлайни з політики агенції для цього пріоритету
        const sla = await slaDueDates(tx, agencyId, input.priority)
        const created = await tx.order.create({
          data: {
            agency: { connect: { id: agencyId } },
            company: { connect: { id: input.companyId } },
            createdBy: { connect: { id: user.sub } },
            ...(input.projectId ? { project: { connect: { id: input.projectId } } } : {}),
            title: input.title,
            description: input.description ?? null,
            type: input.type,
            priority: input.priority,
            ...sla,
            zeroBilled: input.zeroBilled,
            approvalMode,
            requiresApproval,
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
            approvalMode: true,
            requiresApproval: true,
            internalStatus: true,
            clientStatus: true,
            deadline: true,
            createdAt: true,
          },
        })
        await enqueueOutbox(tx, {
          type: 'order.created',
          payload: { orderId: created.id, actorId: user.sub },
          agencyId,
        })
        return created
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
