import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, loginSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { verifyPassword } from '../../auth/password.js'
import { writeAuditAsync } from '../../services/audit.js'
import { isEnabled } from '../../services/twoFactor.js'
import { issueSessionForProfile } from './session.js'
import { signChallenge } from './twoFactor.js'

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
          lastActiveAgencyId: true,
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

      // 2FA gate (S9-01): password verified, but if the account has 2FA enabled we
      // issue NO session tokens yet — only a short-lived challenge the client
      // exchanges at /auth/2fa/login-verify with a TOTP/backup code.
      if (await isEnabled(profile.id)) {
        writeAuditAsync(request.log, {
          actorId: profile.id,
          action: 'auth.2fa_challenge_issued',
          resourceType: 'profile',
          resourceId: profile.id,
          result: 'allowed',
          metadata: { ip: request.ip },
        })
        return reply.status(200).send({
          success: true,
          data: { twoFactorRequired: true, challengeToken: signChallenge(profile.id) },
        })
      }

      const session = await issueSessionForProfile(reply, profile.id)
      if (!session) throw invalidCredentials()

      writeAuditAsync(request.log, {
        actorId: profile.id,
        action: 'auth.login_success',
        resourceType: 'profile',
        resourceId: profile.id,
        result: 'allowed',
        metadata: { ip: request.ip },
      })

      return reply.status(200).send({ success: true, data: session })
    }
  )

  return Promise.resolve()
}

export default loginRoute
