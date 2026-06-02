import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, INVITE_TTL_MS, inviteExecutorSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { generateOpaqueToken } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { sendExecutorInviteEmail } from '../../services/inviteEmail.js'

/** POST /workspace/team/invite — invite an executor (internal team). */
const createExecutorInviteRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/workspace/team/invite',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (!can(request.user, 'executor.invite')) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Недостатньо прав', 403)
      }

      const input = inviteExecutorSchema.parse(request.body)
      const email = input.email.toLowerCase().trim()
      const inviterId = request.user.sub
      // Stamp the inviter's agency so acceptance can create the AgencyMember (R-1).
      const agencyId = requireActiveAgency(request.user)

      // Supersede prior pending invites + issue the new one atomically, so a
      // double-submit can't leave two live invites for the same email (audit S0-S2).
      const invite = await prisma.$transaction(async (tx) => {
        await tx.invite.updateMany({
          where: { email, type: 'executor', usedAt: null },
          data: { usedAt: new Date() },
        })
        return tx.invite.create({
          data: {
            agencyId,
            email,
            token: generateOpaqueToken(),
            type: 'executor',
            invitedById: inviterId,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          },
          select: { id: true, token: true, expiresAt: true },
        })
      })

      const inviter = await prisma.profile.findUnique({
        where: { id: inviterId },
        select: { name: true },
      })

      const workspaceUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
      sendExecutorInviteEmail(request.log, {
        to: email,
        inviterName: inviter?.name ?? 'Workflo',
        acceptUrl: `${workspaceUrl}/invite/${invite.token}`,
        expiresAt: invite.expiresAt.toISOString().slice(0, 16).replace('T', ' '),
      })

      writeAuditAsync(request.log, {
        actorId: inviterId,
        agencyId,
        action: 'executor.invited',
        resourceType: 'invite',
        resourceId: invite.id,
        result: 'allowed',
        metadata: { email },
      })

      return reply.status(201).send({
        success: true,
        data: { inviteId: invite.id, email, expiresAt: invite.expiresAt },
      })
    }
  )

  return Promise.resolve()
}

export default createExecutorInviteRoute
