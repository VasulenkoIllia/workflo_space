import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, loginSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { verifyPassword } from '../../auth/password.js'
import {
  buildAccessClaims,
  issueRefreshToken,
  type Membership,
  setRefreshCookie,
} from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'

// Fixed bcrypt hash of a random string. Compared against when the account is
// not found so response timing doesn't reveal whether an email is registered.
const DUMMY_HASH = '$2a$12$9haBbYWBmA6zfnu60nvKu.PrAqzB6B8axX1IMyrrLyugzaWUpNUMC'

const loginRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/login',
    {
      config: {
        // Brute-force protection (S1-12).
        rateLimit: { max: 10, timeWindow: '15 minutes' },
      },
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body)
      const email = input.email.toLowerCase().trim()

      const profile = await prisma.profile.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          name: true,
        },
      })

      // Generic error — never reveal whether the email exists.
      const invalidCredentials = () =>
        new AppError(ApiErrorCode.UNAUTHORIZED, 'Невірний email або пароль', 401)

      if (!profile) {
        // Equalize timing with the found-account path.
        await verifyPassword(input.password, DUMMY_HASH)
        throw invalidCredentials()
      }

      const passwordOk = await verifyPassword(input.password, profile.passwordHash)
      if (!passwordOk) {
        writeAuditAsync(request.log, {
          actorId: profile.id,
          action: 'auth.login_failed',
          resourceType: 'profile',
          resourceId: profile.id,
          result: 'denied',
          metadata: { reason: 'bad_password', ip: request.ip },
        })
        throw invalidCredentials()
      }

      if (!profile.isActive) {
        // Same generic 401 as bad credentials — never reveal (via a distinct
        // 403) that a known-good credential belongs to a deactivated account.
        writeAuditAsync(request.log, {
          actorId: profile.id,
          action: 'auth.login_failed',
          resourceType: 'profile',
          resourceId: profile.id,
          result: 'denied',
          metadata: { reason: 'account_deactivated', ip: request.ip },
        })
        throw invalidCredentials()
      }

      const memberRows = await prisma.companyMember.findMany({
        where: { profileId: profile.id },
        select: {
          companyId: true,
          role: true,
          permissions: true,
          company: { select: { name: true, slug: true } },
        },
        orderBy: { joinedAt: 'asc' },
      })

      const memberships: Membership[] = memberRows.map((m) => ({
        companyId: m.companyId,
        role: m.role,
        permissions: (m.permissions as Membership['permissions']) ?? undefined,
      }))
      const activeCompanyId = memberships[0]?.companyId ?? null

      const claims = buildAccessClaims({
        profileId: profile.id,
        email: profile.email,
        role: profile.role,
        activeCompanyId,
        memberships,
      })
      const accessToken = await reply.jwtSign(claims)

      const refresh = await issueRefreshToken(prisma, profile.id)
      setRefreshCookie(reply, refresh.token)

      writeAuditAsync(request.log, {
        actorId: profile.id,
        action: 'auth.login_success',
        resourceType: 'profile',
        resourceId: profile.id,
        result: 'allowed',
        metadata: { ip: request.ip },
      })

      return reply.status(200).send({
        success: true,
        data: {
          accessToken,
          profile: {
            id: profile.id,
            email: profile.email,
            displayName: profile.name,
            role: profile.role,
          },
          activeCompanyId,
          companies: memberRows.map((m) => ({
            id: m.companyId,
            name: m.company?.name ?? null,
            slug: m.company?.slug ?? null,
            role: m.role,
          })),
        },
      })
    }
  )

  return Promise.resolve()
}

export default loginRoute
