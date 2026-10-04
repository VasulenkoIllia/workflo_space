import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, INVITE_TTL_MS, inviteCompanyMemberSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { generateOpaqueToken } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { sendCompanyMemberInviteEmail } from '../../services/inviteEmail.js'

/** POST /company/members/invite — company owner invites a member. */
const createMemberInviteRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/company/members/invite',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const input = inviteCompanyMemberSchema.parse(request.body)
      const companyId = input.companyId ?? request.user.activeCompanyId
      if (!companyId) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Не вказано компанію', 400)
      }

      // Only the company OWNER may invite members.
      if (!can(request.user, 'company.invite_member', { companyId })) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Лише власник компанії може запрошувати', 403)
      }

      const email = input.email.toLowerCase().trim()
      const inviterId = request.user.sub

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, agencyId: true },
      })
      if (!company) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)
      }
      // Tenant-guard (ADR-004): the target company must belong to the caller's
      // active agency — closes cross-tenant invite IDOR (security audit 31.05).
      if (company.agencyId !== request.user.activeAgencyId) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ заборонено', 403)
      }

      // Don't re-invite an existing member.
      const existingProfile = await prisma.profile.findUnique({
        where: { email },
        select: { id: true },
      })
      if (existingProfile) {
        const alreadyMember = await prisma.companyMember.findUnique({
          where: { companyId_profileId: { companyId, profileId: existingProfile.id } },
          select: { id: true },
        })
        if (alreadyMember) {
          throw new AppError(ApiErrorCode.CONFLICT, 'Користувач уже є членом компанії', 409)
        }
      }

      // Supersede prior pending invites + issue the new one atomically, so a
      // double-submit can't leave two live invites for the same email (audit S0-S2).
      const invite = await tenantTransaction(prisma, async (tx) => {
        await tx.invite.updateMany({
          where: { email, type: 'company_member', companyId, usedAt: null },
          data: { usedAt: new Date() },
        })
        return tx.invite.create({
          data: {
            email,
            token: generateOpaqueToken(),
            type: 'company_member',
            companyId,
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

      const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
      sendCompanyMemberInviteEmail(request.log, {
        to: email,
        inviterName: inviter?.name ?? 'Workflo',
        companyName: company.name,
        acceptUrl: `${portalUrl}/invite/${invite.token}`,
      })

      writeAuditAsync(request.log, {
        actorId: inviterId,
        action: 'company.member_invited',
        resourceType: 'company',
        resourceId: companyId,
        result: 'allowed',
        metadata: { email, inviteId: invite.id },
      })

      return reply.status(201).send({
        success: true,
        data: { inviteId: invite.id, email, companyId, expiresAt: invite.expiresAt },
      })
    }
  )

  return Promise.resolve()
}

export default createMemberInviteRoute
