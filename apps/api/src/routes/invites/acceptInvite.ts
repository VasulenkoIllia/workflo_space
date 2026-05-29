import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * POST /invite/:token/accept — accept an invite (requires authentication).
 *
 * The authenticated user's email must match the invite. For unauthenticated
 * recipients the frontend routes through login/register first, then back here.
 *
 *   - company_member → create CompanyMember(role='member') with invite permissions
 *   - executor       → promote the profile to role='executor'
 *
 * Marks the invite used inside the same transaction (idempotent guard).
 */
const acceptInviteRoute: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Params: { token: string } }>(
    '/invite/:token/accept',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const profileId = request.user.sub

      const invite = await prisma.invite.findUnique({
        where: { token: request.params.token },
        select: {
          id: true,
          email: true,
          type: true,
          companyId: true,
          permissions: true,
          usedAt: true,
          expiresAt: true,
        },
      })

      const gone = () =>
        new AppError(ApiErrorCode.VALIDATION_ERROR, 'Запрошення недійсне або застаріле', 410)

      if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) {
        throw gone()
      }

      // The invite is bound to a specific email — must match the logged-in user.
      const me = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true, email: true },
      })
      if (!me) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна', 401)
      }
      if (me.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Це запрошення призначене для іншого email', 403)
      }

      if (invite.type === 'company_member') {
        if (!invite.companyId) {
          throw gone()
        }
        const companyId = invite.companyId
        await prisma.$transaction(async (tx) => {
          // Atomic claim: only the first concurrent accept flips usedAt; a racing
          // second request sees count=0 and aborts before mutating membership.
          const claimed = await tx.invite.updateMany({
            where: { id: invite.id, usedAt: null },
            data: { usedAt: new Date() },
          })
          if (claimed.count === 0) {
            throw gone()
          }
          await tx.companyMember.upsert({
            where: { companyId_profileId: { companyId, profileId } },
            update: {}, // already a member → idempotent
            create: {
              companyId,
              profileId,
              role: 'member',
              permissions: (invite.permissions as object) ?? {},
            },
          })
        })

        writeAuditAsync(request.log, {
          actorId: profileId,
          action: 'company.member_joined',
          resourceType: 'company',
          resourceId: companyId,
          result: 'allowed',
          metadata: { inviteId: invite.id },
        })

        return reply.status(200).send({
          success: true,
          data: { type: 'company_member', companyId, role: 'member' },
        })
      }

      // executor invite → promote profile to executor
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.invite.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedAt: new Date() },
        })
        if (claimed.count === 0) {
          throw gone()
        }
        await tx.profile.update({ where: { id: profileId }, data: { role: 'executor' } })
      })

      writeAuditAsync(request.log, {
        actorId: profileId,
        action: 'executor.joined',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { inviteId: invite.id },
      })

      return reply.status(200).send({
        success: true,
        data: { type: 'executor', role: 'executor' },
      })
    }
  )

  return Promise.resolve()
}

export default acceptInviteRoute
