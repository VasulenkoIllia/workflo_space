import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * Agency-side management of a CLIENT company's members (28-Б «Люди»). Acting on a client's
 * user accounts is sensitive → OWNER-only (not the whole team). Tenant-scoped (the company
 * must belong to the active agency → 404 otherwise). The last owner can never be demoted or
 * removed, so a company can't be orphaned. Audited.
 */
const MEMBER_KEY = (companyId: string, profileId: string) => ({
  companyId_profileId: { companyId, profileId },
})

const MEMBER_SELECT = {
  role: true,
  joinedAt: true,
  profile: { select: { id: true, name: true, email: true } },
} as const

const roleSchema = z.object({ role: z.enum(['owner', 'member']) }).strict()

type MemberRow = {
  role: string
  joinedAt: Date
  profile: { id: string; name: string; email: string }
}
const toDto = (m: MemberRow) => ({
  profileId: m.profile.id,
  name: m.profile.name,
  email: m.profile.email,
  role: m.role,
  joinedAt: m.joinedAt,
})

const clientMembersRoute: FastifyPluginAsync = (fastify) => {
  // ── Change a client member's role (owner ↔ member) ────────────────────────────
  fastify.patch<{ Params: { id: string; profileId: string } }>(
    '/workspace/clients/:id/members/:profileId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = roleSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може керувати користувачами клієнта',
          403
        )
      }
      const { id: companyId, profileId } = request.params

      const member = await tenantTransaction(prisma, async (tx) => {
        const company = await tx.company.findFirst({
          where: { id: companyId, agencyId },
          select: { id: true },
        })
        if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        // Serialize concurrent role/remove ops on this company's members so the last-owner
        // count→write guard can't be raced into an owner-less (orphaned) company (audit MEDIUM).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`companyMembers:${companyId}`}))`

        const current = await tx.companyMember.findUnique({
          where: MEMBER_KEY(companyId, profileId),
          select: { role: true },
        })
        if (!current) throw new AppError(ApiErrorCode.NOT_FOUND, 'Користувача не знайдено', 404)

        // Demoting the last owner would orphan the company → refuse.
        if (current.role === 'owner' && role !== 'owner') {
          const owners = await tx.companyMember.count({
            where: { companyId, role: 'owner' },
          })
          if (owners <= 1) {
            throw new AppError(
              ApiErrorCode.VALIDATION_ERROR,
              'Не можна зняти роль з останнього власника компанії',
              409
            )
          }
        }

        return tx.companyMember.update({
          where: MEMBER_KEY(companyId, profileId),
          data: { role },
          select: MEMBER_SELECT,
        })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'company.member_role_changed',
        resourceType: 'company',
        resourceId: companyId,
        result: 'allowed',
        metadata: { profileId, role, onBehalf: true },
      })
      return reply.send({ success: true, data: { member: toDto(member) } })
    }
  )

  // ── Remove a client member ────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string; profileId: string } }>(
    '/workspace/clients/:id/members/:profileId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(
          ApiErrorCode.FORBIDDEN,
          'Лише власник агенції може керувати користувачами клієнта',
          403
        )
      }
      const { id: companyId, profileId } = request.params

      await tenantTransaction(prisma, async (tx) => {
        const company = await tx.company.findFirst({
          where: { id: companyId, agencyId },
          select: { id: true },
        })
        if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
        // Serialize concurrent role/remove ops on this company's members so the last-owner
        // count→write guard can't be raced into an owner-less (orphaned) company (audit MEDIUM).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`companyMembers:${companyId}`}))`

        const current = await tx.companyMember.findUnique({
          where: MEMBER_KEY(companyId, profileId),
          select: { role: true },
        })
        if (!current) throw new AppError(ApiErrorCode.NOT_FOUND, 'Користувача не знайдено', 404)

        if (current.role === 'owner') {
          const owners = await tx.companyMember.count({ where: { companyId, role: 'owner' } })
          if (owners <= 1) {
            throw new AppError(
              ApiErrorCode.VALIDATION_ERROR,
              'Не можна видалити останнього власника компанії',
              409
            )
          }
        }

        await tx.companyMember.delete({ where: MEMBER_KEY(companyId, profileId) })
      })

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'company.member_removed',
        resourceType: 'company',
        resourceId: companyId,
        result: 'allowed',
        metadata: { profileId, onBehalf: true },
      })
      return reply.send({ success: true, data: { removed: profileId } })
    }
  )

  return Promise.resolve()
}

export default clientMembersRoute
