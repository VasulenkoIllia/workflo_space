import { prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, updateClientRequisitesSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'
import { REQUISITES_SELECT, applyClientRequisites } from '../../services/clientRequisites.js'
import { requirePermission } from '../../auth/permissions.js'
import { coercePermissions } from '../../auth/tokens.js'

/**
 * Client legal requisites (06-Б, P-3) — the document "to" party. The client fills/reads
 * their OWN company's requisites in Portal; the agency reads them (document readiness).
 * Editing is gated to the company owner (`company.update_settings`); the agency-side edit
 * on behalf lands with company management (28-Б). The contract-gate that blocks generation
 * is P-7; S6 consumes these fields for document generation.
 */
type AuthUser = Parameters<typeof can>[0]

const EMPTY_ACTIVITY = { activeOrders: 0, comments30d: 0, lastActiveAt: null as Date | null }
const DAY_MS = 86_400_000

/**
 * DSN-6 (design-v2 portal-team.jsx): активність учасників компанії — відкриті замовлення,
 * які людина створила; публічні коментарі в чатах замовлень компанії за 30 днів; остання
 * активність (останнє оновлення сесії). Три агрегати на весь склад, без N+1.
 */
async function memberActivity(companyId: string, profileIds: string[]) {
  const out = new Map<string, typeof EMPTY_ACTIVITY>()
  if (profileIds.length === 0) return out
  const since = new Date(Date.now() - 30 * DAY_MS)
  const [orders, comments, sessions] = await Promise.all([
    withTenant((tx) =>
      tx.order.groupBy({
        by: ['createdById'],
        where: {
          companyId,
          deletedAt: null,
          createdById: { in: profileIds },
          internalStatus: { notIn: ['done', 'cancelled'] },
        },
        _count: { _all: true },
      })
    ),
    withTenant((tx) =>
      tx.orderComment.groupBy({
        by: ['authorId'],
        where: {
          authorId: { in: profileIds },
          isInternal: false,
          createdAt: { gte: since },
          order: { companyId },
        },
        _count: { _all: true },
      })
    ),
    prisma.refreshToken.groupBy({
      by: ['profileId'],
      where: { profileId: { in: profileIds } },
      _max: { createdAt: true },
    }),
  ])
  const get = (id: string) => {
    const cur = out.get(id) ?? { ...EMPTY_ACTIVITY }
    out.set(id, cur)
    return cur
  }
  for (const o of orders) get(o.createdById).activeOrders = o._count._all
  for (const c of comments) get(c.authorId).comments30d = c._count._all
  for (const r of sessions) get(r.profileId).lastActiveAt = r._max.createdAt
  return out
}

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
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Реквізити доступні лише власнику', 403)
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
            permissions: true, // PORTAL-MEMBER: права учасника
            profile: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        })
      )
      const activity = await memberActivity(
        companyId,
        members.map((m) => m.profile.id)
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
            permissions: coercePermissions(m.permissions) ?? {},
            ...(activity.get(m.profile.id) ?? EMPTY_ACTIVITY),
          })),
        },
      })
    }
  )

  // ── Agency reads a client's member roster (28-Б «Люди» tab) ───────────────────
  fastify.get<{ Params: { id: string } }>(
    '/workspace/clients/:id/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      await requirePermission(request, 'clients.view')
      const members = await withTenant(async (tx) => {
        const company = await tx.company.findFirst({
          where: { id: request.params.id, agencyId },
          select: { id: true },
        })
        if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        return tx.companyMember.findMany({
          where: { companyId: company.id },
          select: {
            role: true,
            joinedAt: true,
            permissions: true, // PORTAL-MEMBER: права учасника
            profile: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        })
      })
      return reply.send({
        success: true,
        data: {
          members: members.map((m) => ({
            profileId: m.profile.id,
            name: m.profile.name,
            email: m.profile.email,
            role: m.role,
            joinedAt: m.joinedAt,
            permissions: coercePermissions(m.permissions) ?? {},
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
      await requirePermission(request, 'clients.requisites')
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

  // ── Agency edits a client's requisites on behalf (28-Б) ───────────────────────
  // Same fields/gate-recompute as the portal self-edit; here the agency team fills the
  // client's legal data so documents can be issued. Manager-blocked (legal/PII), audited
  // with onBehalf:true. Cross-tenant id → 404 via applyClientRequisites' agency check.
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/clients/:id/requisites',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateClientRequisitesSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      await requirePermission(request, 'clients.requisites')
      const requisites = await tenantTransaction(prisma, (tx) =>
        applyClientRequisites(tx, { agencyId, companyId: request.params.id, input })
      )
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'company.requisites_updated',
        resourceType: 'company',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { fields: Object.keys(input), onBehalf: true },
      })
      return reply.send({ success: true, data: { requisites } })
    }
  )

  return Promise.resolve()
}

export default companyRequisitesRoute
