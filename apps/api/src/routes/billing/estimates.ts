import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  createEstimateLineSchema,
  updateEstimateLineSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { moduleEnabled } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'
import {
  createEstimateLine,
  deleteEstimateLine,
  estimateLineDto,
  getEstimate,
  updateEstimateLine,
} from '../../services/estimate.js'

/**
 * Project estimate lines (02-Б, P-6). Workspace = internal-team editor (CRUD); Portal =
 * the client's read-only view of their own project's estimate. Each created line spawns a
 * zeroBilled kanban task; Σ(hours) reconciles against the project's includedHoursCap (soft —
 * overage billing is the P-2 cycle-engine). Gated by `moduleEnabled('billing')` (MOD-2).
 */
const estimatesRoute: FastifyPluginAsync = (fastify) => {
  // ── Workspace: list + reconciliation ──────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/projects/:id/estimate-lines',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (
        !isInternalTeam(user) ||
        isAgencyManager(user, agencyId) ||
        !(await moduleEnabled(agencyId, 'billing'))
      ) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const estimate = await withTenant((tx) =>
        getEstimate(tx, { agencyId, projectId: request.params.id })
      )
      return reply.send({ success: true, data: { estimate } })
    }
  )

  // ── Workspace: create a line (+ auto zeroBilled task) ─────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/workspace/projects/:id/estimate-lines',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = createEstimateLineSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (
        !isInternalTeam(user) ||
        isAgencyManager(user, agencyId) ||
        !(await moduleEnabled(agencyId, 'billing'))
      ) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const line = await tenantTransaction(prisma, (tx) =>
        createEstimateLine(tx, { agencyId, projectId: request.params.id, actorId: user.sub, input })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'estimate_line.created',
        resourceType: 'estimate_line',
        resourceId: line.id,
        result: 'allowed',
        metadata: { projectId: request.params.id, hours: input.hours },
      })
      return reply.status(201).send({ success: true, data: { line: estimateLineDto(line) } })
    }
  )

  // ── Workspace: update a line (syncs the spawned task) ─────────────────────────
  fastify.patch<{ Params: { id: string; lineId: string } }>(
    '/workspace/projects/:id/estimate-lines/:lineId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateEstimateLineSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (
        !isInternalTeam(user) ||
        isAgencyManager(user, agencyId) ||
        !(await moduleEnabled(agencyId, 'billing'))
      ) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const line = await tenantTransaction(prisma, (tx) =>
        updateEstimateLine(tx, {
          agencyId,
          projectId: request.params.id,
          lineId: request.params.lineId,
          input,
        })
      )
      return reply.send({ success: true, data: { line: estimateLineDto(line) } })
    }
  )

  // ── Workspace: delete a line (leaves the spawned task) ────────────────────────
  fastify.delete<{ Params: { id: string; lineId: string } }>(
    '/workspace/projects/:id/estimate-lines/:lineId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (
        !isInternalTeam(user) ||
        isAgencyManager(user, agencyId) ||
        !(await moduleEnabled(agencyId, 'billing'))
      ) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      await tenantTransaction(prisma, (tx) =>
        deleteEstimateLine(tx, {
          agencyId,
          projectId: request.params.id,
          lineId: request.params.lineId,
        })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'estimate_line.deleted',
        resourceType: 'estimate_line',
        resourceId: request.params.lineId,
        result: 'allowed',
        metadata: { projectId: request.params.id },
      })
      return reply.send({ success: true })
    }
  )

  // ── Portal: client's read-only view of their own project's estimate ───────────
  fastify.get<{ Params: { id: string } }>(
    '/portal/projects/:id/estimate-lines',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      const companyId = user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
      }
      if (!(await moduleEnabled(agencyId, 'billing'))) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Модуль білінгу вимкнено', 403)
      }
      if (!can(user, 'billing.view', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до білінгу', 403)
      }
      // The project must belong to the caller's own company (not just the tenant).
      const project = await withTenant((tx) =>
        tx.project.findFirst({
          where: { id: request.params.id, agencyId, companyId },
          select: { id: true },
        })
      )
      if (!project) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
      }
      const estimate = await withTenant((tx) =>
        getEstimate(tx, { agencyId, projectId: request.params.id })
      )
      return reply.send({ success: true, data: { estimate } })
    }
  )

  return Promise.resolve()
}

export default estimatesRoute
