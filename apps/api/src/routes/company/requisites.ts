import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, updateClientRequisitesSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { REQUISITES_SELECT, applyClientRequisites } from '../../services/clientRequisites.js'

/**
 * Client legal requisites (06-Б, P-3) — the document "to" party. The client fills/reads
 * their OWN company's requisites in Portal; the agency reads them (document readiness).
 * Editing is gated to the company owner (`company.update_settings`); the agency-side edit
 * on behalf lands with company management (28-Б). The contract-gate that blocks generation
 * is P-7; S6 consumes these fields for document generation.
 */
type AuthUser = Parameters<typeof can>[0]

const companyRequisitesRoute: FastifyPluginAsync = (fastify) => {
  function activeCompany(user: AuthUser): { agencyId: string; companyId: string } {
    const agencyId = requireActiveAgency(user)
    const companyId = user.activeCompanyId
    if (!companyId) {
      throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Немає активної компанії', 400)
    }
    return { agencyId, companyId }
  }

  // ── Client reads their own requisites (owner-gated — legal/PII, not delegable) ──
  fastify.get(
    '/portal/company/requisites',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const { agencyId, companyId } = activeCompany(user)
      // Legal identity (IBAN/tax-id/signatory) is owner-only, like the write — NOT the
      // delegable `billing.view` used for transactional records.
      if (!can(user, 'company.update_settings', { agencyId, companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу', 403)
      }
      const requisites = await withTenant((tx) =>
        tx.company.findFirst({ where: { id: companyId, agencyId }, select: REQUISITES_SELECT })
      )
      if (!requisites) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }
      return reply.send({ success: true, data: { requisites } })
    }
  )

  // ── Client updates their own requisites (owner-gated) ─────────────────────────
  fastify.patch(
    '/portal/company/requisites',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateClientRequisitesSchema.parse(request.body)
      const user = request.user
      const { agencyId, companyId } = activeCompany(user)
      if (!can(user, 'company.update_settings', { agencyId, companyId })) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник компанії може змінювати реквізити',
          403
        )
      }
      const requisites = await tenantTransaction(prisma, (tx) =>
        applyClientRequisites(tx, { agencyId, companyId, input })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'company.requisites_updated',
        resourceType: 'company',
        resourceId: companyId,
        result: 'allowed',
        metadata: { fields: Object.keys(input) },
      })
      return reply.send({ success: true, data: { requisites } })
    }
  )

  // ── Client reads their company's member roster (read-only; tenant-scoped to own company) ──
  fastify.get(
    '/portal/company/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const { companyId } = activeCompany(user)
      const members = await withTenant((tx) =>
        tx.companyMember.findMany({
          where: { companyId },
          select: {
            role: true,
            joinedAt: true,
            profile: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        })
      )
      return reply.send({
        success: true,
        data: {
          members: members.map((m) => ({
            profileId: m.profile.id,
            name: m.profile.name,
            email: m.profile.email,
            role: m.role,
            joinedAt: m.joinedAt,
          })),
        },
      })
    }
  )

  // ── Agency reads a client's requisites (document readiness) ───────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/clients/:id/requisites',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      // Client legal/PII (tax-id/IBAN/signatory) → manager-blocked like the finance surface (MOD-4).
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const requisites = await withTenant((tx) =>
        tx.company.findFirst({
          where: { id: request.params.id, agencyId },
          select: REQUISITES_SELECT,
        })
      )
      if (!requisites) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }
      return reply.send({ success: true, data: { requisites } })
    }
  )

  return Promise.resolve()
}

export default companyRequisitesRoute
