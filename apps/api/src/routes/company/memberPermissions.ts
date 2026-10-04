import { prisma, tenantTransaction } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  updateCompanyMemberPermissionsSchema,
  type UpdateCompanyMemberPermissionsInput,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../auth/permissions.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { coercePermissions } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * PORTAL-MEMBER (рішення власника 27.09): керування учасниками компанії-клієнта.
 *  • портал — власник компанії вмикає учаснику права (білінг / погодження / інвайти) і
 *    видаляє учасника;
 *  • агенція (clients.manage) — те саме з картки клієнта 360°.
 * Власник компанії має всі права завжди (його прапорці не редагуються). Прапорці читає `can()`
 * з claims токена — зміна діє з наступним оновленням сесії учасника (≤15 хв).
 */
async function applyPermissions(
  companyId: string,
  profileId: string,
  patch: UpdateCompanyMemberPermissionsInput
) {
  return tenantTransaction(prisma, async (tx) => {
    const member = await tx.companyMember.findUnique({
      where: { companyId_profileId: { companyId, profileId } },
      select: { role: true, permissions: true },
    })
    if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Учасника не знайдено', 404)
    if (member.role === 'owner') {
      throw new AppError(
        ApiErrorCode.VALIDATION_ERROR,
        'Власник компанії має всі права — їх не змінюють',
        400
      )
    }
    const next = { ...(coercePermissions(member.permissions) ?? {}), ...patch }
    await tx.companyMember.update({
      where: { companyId_profileId: { companyId, profileId } },
      data: { permissions: next },
    })
    return next
  })
}

const memberPermissionsRoute: FastifyPluginAsync = (fastify) => {
  // ── Портал: власник компанії → права учасника ─────────────────────────────────
  fastify.patch<{ Params: { profileId: string } }>(
    '/portal/company/members/:profileId/permissions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const companyId = user.activeCompanyId
      const own = user.memberships.find((m) => m.companyId === companyId)
      if (!companyId || own?.role !== 'owner') {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Права учасників змінює власник компанії', 403)
      }
      const patch = updateCompanyMemberPermissionsSchema.parse(request.body)
      const permissions = await applyPermissions(companyId, request.params.profileId, patch)
      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'company.member_permissions_changed',
        resourceType: 'company',
        resourceId: companyId,
        result: 'allowed',
        metadata: { profileId: request.params.profileId, ...patch },
      })
      return reply.send({
        success: true,
        data: { profileId: request.params.profileId, permissions },
      })
    }
  )

  // ── Портал: власник компанії видаляє учасника ─────────────────────────────────
  fastify.delete<{ Params: { profileId: string } }>(
    '/portal/company/members/:profileId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const companyId = user.activeCompanyId
      const own = user.memberships.find((m) => m.companyId === companyId)
      if (!companyId || own?.role !== 'owner') {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Учасників видаляє власник компанії', 403)
      }
      const profileId = request.params.profileId
      if (profileId === user.sub) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Себе видалити не можна', 400)
      }
      await tenantTransaction(prisma, async (tx) => {
        const member = await tx.companyMember.findUnique({
          where: { companyId_profileId: { companyId, profileId } },
          select: { role: true },
        })
        if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Учасника не знайдено', 404)
        // Власника компанії з порталу не видаляємо (передача власності — окремий флоу агенції)
        if (member.role === 'owner') {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Власника компанії не видалити', 400)
        }
        await tx.companyMember.delete({
          where: { companyId_profileId: { companyId, profileId } },
        })
      })
      writeAuditAsync(request.log, {
        actorId: user.sub,
        action: 'company.member_removed',
        resourceType: 'company',
        resourceId: companyId,
        result: 'allowed',
        metadata: { profileId },
      })
      return reply.send({ success: true, data: { profileId } })
    }
  )

  // ── Агенція: права учасника клієнта з картки 360° (clients.manage) ────────────
  fastify.patch<{ Params: { id: string; profileId: string } }>(
    '/workspace/clients/:id/members/:profileId/permissions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireActiveAgency(request.user)
      await requirePermission(request, 'clients.manage')
      const patch = updateCompanyMemberPermissionsSchema.parse(request.body)
      const company = await prisma.company.findFirst({
        where: { id: request.params.id, agencyId },
        select: { id: true },
      })
      if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      const permissions = await applyPermissions(company.id, request.params.profileId, patch)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'company.member_permissions_changed',
        resourceType: 'company',
        resourceId: company.id,
        result: 'allowed',
        metadata: { profileId: request.params.profileId, onBehalf: true, ...patch },
      })
      return reply.send({
        success: true,
        data: { profileId: request.params.profileId, permissions },
      })
    }
  )

  return Promise.resolve()
}

export default memberPermissionsRoute
