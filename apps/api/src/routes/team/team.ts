import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, updateMemberRoleSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isAgencyOwner, requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

const capacitySchema = z.object({
  weeklyCapacityHours: z.number().int().min(0).max(168).nullable(),
})

/**
 * GET /workspace/team (S5-04) — agency members with their profile and current
 * (open-window) compensation rate. Internal-team read.
 */
const teamRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/workspace/team', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user
    const agencyId = requireActiveAgency(user)
    if (!isInternalTeam(user)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
    }
    // Compensation is owner-only — an executor must not see teammates' salaries.
    const canSeeRates = isAgencyOwner(user, agencyId)

    const { members, rates } = await withTenant(async (tx) => {
      const [members, rates] = await Promise.all([
        tx.agencyMember.findMany({
          where: { agencyId },
          select: {
            profileId: true,
            role: true,
            createdAt: true,
            weeklyCapacityHours: true,
            // TEAM-BOARDS: команда члена
            teamId: true,
            team: { select: { id: true, name: true, color: true } },
            profile: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        tx.executorRate.findMany({
          where: { agencyId, effectiveUntil: null },
          select: {
            executorId: true,
            monthlySalary: true,
            hourlyRate: true,
            commissionPercent: true,
            currency: true,
            zeroCostDefault: true,
          },
        }),
      ])
      return { members, rates }
    })

    const rateByExec = new Map(rates.map((r) => [r.executorId, r]))

    return reply.send({
      success: true,
      data: {
        members: members.map((m) => {
          const rate = canSeeRates ? rateByExec.get(m.profileId) : undefined
          return {
            profileId: m.profileId,
            role: m.role,
            name: m.profile.name,
            email: m.profile.email,
            joinedAt: m.createdAt,
            weeklyCapacityHours: m.weeklyCapacityHours,
            teamId: m.teamId,
            team: m.team,
            rate: rate
              ? {
                  monthlySalary: rate.monthlySalary ? rate.monthlySalary.toFixed(2) : null,
                  hourlyRate: rate.hourlyRate ? rate.hourlyRate.toFixed(2) : null,
                  commissionPercent: rate.commissionPercent.toString(),
                  currency: rate.currency,
                  zeroCostDefault: rate.zeroCostDefault,
                }
              : null,
          }
        }),
      },
    })
  })

  // ── Set a member's weekly capacity norm (owner-only, 12-ПЛАН-ФАКТ) ─────────────
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/executors/:id/capacity',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = capacitySchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції', 403)
      }
      const updated = await withTenant(async (tx) => {
        const member = await tx.agencyMember.findUnique({
          where: { agencyId_profileId: { agencyId, profileId: request.params.id } },
          select: { id: true },
        })
        if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Учасника не знайдено', 404)
        return tx.agencyMember.update({
          where: { agencyId_profileId: { agencyId, profileId: request.params.id } },
          data: { weeklyCapacityHours: input.weeklyCapacityHours },
          select: { profileId: true, weeklyCapacityHours: true },
        })
      })
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'team.capacity_set',
        resourceType: 'agency_member',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { weeklyCapacityHours: input.weeklyCapacityHours },
      })
      return reply.send({ success: true, data: { member: updated } })
    }
  )

  // ── Change a member's role (owner-only, 12-EDITMEMBER) ─────────────────────────
  // Targets are manager/executor only (schema-enforced), and an OWNER row cannot be
  // touched here at all — demoting the last owner would lock the agency out;
  // ownership transfer is a separate deliberate flow, not a roster edit.
  fastify.patch<{ Params: { id: string } }>(
    '/workspace/executors/:id/role',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateMemberRoleSchema.parse(request.body)
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isAgencyOwner(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник агенції', 403)
      }
      const updated = await withTenant(async (tx) => {
        const member = await tx.agencyMember.findUnique({
          where: { agencyId_profileId: { agencyId, profileId: request.params.id } },
          select: { id: true, role: true },
        })
        if (!member) throw new AppError(ApiErrorCode.NOT_FOUND, 'Учасника не знайдено', 404)
        if (member.role === 'owner') {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            'Роль власника змінюється лише передачею власності',
            409
          )
        }
        return tx.agencyMember.update({
          where: { agencyId_profileId: { agencyId, profileId: request.params.id } },
          data: { role: input.role },
          select: { profileId: true, role: true },
        })
      })
      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'team.role_set',
        resourceType: 'agency_member',
        resourceId: request.params.id,
        result: 'allowed',
        metadata: { role: input.role },
      })
      return reply.send({ success: true, data: { member: updated } })
    }
  )

  return Promise.resolve()
}

export default teamRoute
