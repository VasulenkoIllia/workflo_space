import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, pnlQuerySchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { computeClientMargin, computeProjectMargin } from '../../services/margin.js'

/**
 * Margin reports (S5.6 P-9, module 22-Д). Owner-only — margin/cost visibility is
 * agency-admin-only (PROJECTS_SPEC §4.3); executors never see client rates or margin.
 * Reuses `pnlQuerySchema` (inclusive `YYYY-MM-DD` window). Charges are matched by their
 * month anchor, so windows should bound whole months (aligned with billing periods).
 */
type AuthUser = Parameters<typeof isAgencyOwner>[0]

const marginRoute: FastifyPluginAsync = (fastify) => {
  function ownerOrThrow(user: AuthUser, agencyId: string): void {
    if (!isAgencyOwner(user, agencyId)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції має доступ до маржі', 403)
    }
  }

  function window(from: string, to: string): { from: Date; to: Date } {
    return { from: new Date(`${from}T00:00:00.000Z`), to: new Date(`${to}T23:59:59.999Z`) }
  }

  // ── One project's margin ──────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/projects/:id/margin',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      ownerOrThrow(user, agencyId)

      const { from, to } = window(query.from, query.to)
      const margin = await withTenant((tx) =>
        computeProjectMargin(tx, { agencyId, projectId: request.params.id, from, to })
      )
      if (!margin) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
      }
      return reply.send({ success: true, data: { from: query.from, to: query.to, margin } })
    }
  )

  // ── A client's rolled-up margin (all their projects) ──────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/companies/:id/margin',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = pnlQuerySchema.parse(request.query)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      ownerOrThrow(user, agencyId)

      const { from, to } = window(query.from, query.to)
      const margin = await withTenant((tx) =>
        computeClientMargin(tx, { agencyId, companyId: request.params.id, from, to })
      )
      if (!margin) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Клієнта не знайдено', 404)
      }
      return reply.send({ success: true, data: { from: query.from, to: query.to, margin } })
    }
  )

  return Promise.resolve()
}

export default marginRoute
