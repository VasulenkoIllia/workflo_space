import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'

/**
 * GET /invite/:token — public preview of an invite for the accept page.
 * Returns minimal info + a derived status (pending | used | expired).
 */
const getInviteRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { token: string } }>(
    '/invite/:token',
    { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const invite = await prisma.invite.findUnique({
        where: { token: request.params.token },
        select: {
          email: true,
          type: true,
          usedAt: true,
          expiresAt: true,
          companyId: true,
          invitedBy: { select: { name: true } },
        },
      })

      if (!invite) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Запрошення не знайдено', 404)
      }

      // Invite has no `company` relation — fetch the name when a company is set.
      let companyName: string | null = null
      if (invite.companyId) {
        const company = await prisma.company.findUnique({
          where: { id: invite.companyId },
          select: { name: true },
        })
        companyName = company?.name ?? null
      }

      const status = invite.usedAt
        ? 'used'
        : invite.expiresAt.getTime() < Date.now()
          ? 'expired'
          : 'pending'

      // NB: invite.email is intentionally NOT returned — this endpoint is public
      // (token may be guessable as a UUID) and the email is PII. The email match
      // is enforced at accept-time against the authenticated user.
      return reply.status(200).send({
        success: true,
        data: {
          type: invite.type,
          status,
          inviterName: invite.invitedBy?.name ?? null,
          companyName,
          expiresAt: invite.expiresAt,
        },
      })
    }
  )

  return Promise.resolve()
}

export default getInviteRoute
