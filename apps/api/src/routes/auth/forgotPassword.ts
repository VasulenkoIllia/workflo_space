import { prisma } from '@workflo/db'
import { forgotPasswordSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { dispatchNotification } from '../../services/notifications.js'
import { writeAuditAsync } from '../../services/audit.js'

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * POST /auth/forgot-password — request a password reset link.
 *
 * Always returns 200 regardless of whether the email exists (anti-enumeration).
 * If a matching active profile exists, creates a 1h PasswordResetToken and
 * dispatches the auth.password_reset notification (CRITICAL_EVENT → always email).
 */
const forgotPasswordRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/forgot-password',
    {
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const input = forgotPasswordSchema.parse(request.body)
      const email = input.email.toLowerCase().trim()

      const profile = await prisma.profile.findUnique({
        where: { email },
        select: { id: true, isActive: true },
      })

      if (profile && profile.isActive) {
        const token = (
          await prisma.passwordResetToken.create({
            data: { email, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
            select: { token: true },
          })
        ).token

        const portalUrl = process.env.APP_PORTAL_URL ?? 'https://portal.workflo.space'
        const resetUrl = `${portalUrl}/reset-password?token=${encodeURIComponent(token)}`

        dispatchNotification(request.log, {
          profileId: profile.id,
          event: 'auth.password_reset',
          vars: { resetUrl },
        })

        writeAuditAsync(request.log, {
          actorId: profile.id,
          action: 'auth.password_reset_requested',
          resourceType: 'profile',
          resourceId: profile.id,
          result: 'allowed',
          metadata: { ip: request.ip },
        })
      }

      // Identical response whether or not the account exists.
      return reply.status(200).send({
        success: true,
        data: {
          message: 'Якщо акаунт існує, ми надіслали лист із посиланням для скидання пароля.',
        },
      })
    }
  )

  return Promise.resolve()
}

export default forgotPasswordRoute
