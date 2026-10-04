import { prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, permissionRoleSchema, setPermissionSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { invalidatePermissions } from '../../auth/permissions.js'
import { requireOwnerAgency } from '../../auth/tenant.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * PERM-1: керування правами доступу — ЛИШЕ власник агенції (не право каталогу: інакше
 * самопідвищення). Матриця ролей (manager/lead/executor) + персональні права людини. У БД
 * живуть тільки відхилення від дефолтів (@workflo/types PERMISSIONS); `level: null` —
 * скинути відхилення. Кожна зміна → audit + скидання кешу прав агенції.
 */
const permissionsRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/workspace/permissions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireOwnerAgency(request.user, 'Права доступу налаштовує лише власник')
      const { roleRows, memberRows, members, leads } = await withTenant(async (tx) => {
        const [roleRows, memberRows, members, leads] = await Promise.all([
          tx.agencyRolePermission.findMany({
            where: { agencyId },
            select: { role: true, permission: true, level: true, updatedAt: true },
          }),
          tx.agencyMemberPermission.findMany({
            where: { agencyId },
            select: { profileId: true, permission: true, level: true, updatedAt: true },
          }),
          tx.agencyMember.findMany({
            where: { agencyId },
            select: { profileId: true, role: true, profile: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
          }),
          tx.team.findMany({
            where: { agencyId, leadId: { not: null } },
            select: { leadId: true },
          }),
        ])
        return { roleRows, memberRows, members, leads }
      })
      const leadIds = new Set(leads.map((t) => t.leadId))
      return reply.send({
        success: true,
        data: {
          roleOverrides: roleRows,
          members: members.map((m) => ({
            profileId: m.profileId,
            name: m.profile.name,
            role: m.role,
            isLead: m.role === 'executor' && leadIds.has(m.profileId),
            overrides: memberRows
              .filter((r) => r.profileId === m.profileId)
              .map((r) => ({ permission: r.permission, level: r.level })),
          })),
        },
      })
    }
  )

  fastify.put<{ Params: { role: string } }>(
    '/workspace/permissions/roles/:role',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireOwnerAgency(request.user, 'Права доступу налаштовує лише власник')
      const role = permissionRoleSchema.parse(request.params.role)
      const input = setPermissionSchema.parse(request.body)
      await withTenant(async (tx) => {
        if (input.level === null) {
          await tx.agencyRolePermission.deleteMany({
            where: { agencyId, role, permission: input.permission },
          })
        } else {
          await tx.agencyRolePermission.upsert({
            where: {
              agencyId_role_permission: { agencyId, role, permission: input.permission },
            },
            create: {
              agencyId,
              role,
              permission: input.permission,
              level: input.level,
              updatedById: request.user.sub,
            },
            update: { level: input.level, updatedById: request.user.sub },
          })
        }
      })
      invalidatePermissions(agencyId)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'permissions.role_changed',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { role, permission: input.permission, level: input.level },
      })
      return reply.send({ success: true, data: { role, ...input } })
    }
  )

  fastify.put<{ Params: { profileId: string } }>(
    '/workspace/permissions/members/:profileId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = requireOwnerAgency(request.user, 'Права доступу налаштовує лише власник')
      const input = setPermissionSchema.parse(request.body)
      const profileId = request.params.profileId
      const member = await prisma.agencyMember.findUnique({
        where: { agencyId_profileId: { agencyId, profileId } },
        select: { role: true },
      })
      if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Учасника не знайдено', 404)
      if (member.role === 'owner') {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Власник має всі права — персональні обмеження не застосовуються',
          400
        )
      }
      await withTenant(async (tx) => {
        if (input.level === null) {
          await tx.agencyMemberPermission.deleteMany({
            where: { agencyId, profileId, permission: input.permission },
          })
        } else {
          await tx.agencyMemberPermission.upsert({
            where: {
              agencyId_profileId_permission: { agencyId, profileId, permission: input.permission },
            },
            create: {
              agencyId,
              profileId,
              permission: input.permission,
              level: input.level,
              updatedById: request.user.sub,
            },
            update: { level: input.level, updatedById: request.user.sub },
          })
        }
      })
      invalidatePermissions(agencyId)
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'permissions.member_changed',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { agencyId, permission: input.permission, level: input.level },
      })
      return reply.send({ success: true, data: { profileId, ...input } })
    }
  )

  return Promise.resolve()
}

export default permissionsRoute
