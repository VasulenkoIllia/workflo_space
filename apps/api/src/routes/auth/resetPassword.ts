import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, resetPasswordSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { hashPassword } from '../../auth/password.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * POST /auth/reset-password — consume a reset token and set a new password.
 *
 * Validates the token (exists / unused / not expired), updates the password,
 * marks the token used, and revokes ALL refresh tokens for the profile (force
 * re-login everywhere — standard post-reset hygiene).
 */
const resetPasswordRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/auth/reset-password',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const input = resetPasswordSchema.parse(request.body)

      const tokenRow = await prisma.passwordResetToken.findUnique({
        where: { token: input.token },
        select: { id: true, email: true, usedAt: true, expiresAt: true },
      })

      const invalid = () =>
        new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          'Посилання недійсне або застаріле. Запитайте нове.',
          410
        )

      if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt.getTime() < Date.now()) {
        throw invalid()
      }

      const profile = await prisma.profile.findUnique({
        where: { email: tokenRow.email },
        select: { id: true, isActive: true },
      })
      if (!profile || !profile.isActive) {
        throw invalid()
      }

      const passwordHash = await hashPassword(input.password)

      await tenantTransaction(prisma, async (tx) => {
        await tx.profile.update({
          where: { id: profile.id },
          data: { passwordHash },
        })
        await tx.passwordResetToken.update({
          where: { id: tokenRow.id },
          data: { usedAt: new Date() },
        })
        // Invalidate every active session — user must log in again.
        await tx.refreshToken.updateMany({
          where: { profileId: profile.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      })

      writeAuditAsync(request.log, {
        actorId: profile.id,
        action: 'auth.password_changed',
        resourceType: 'profile',
        resourceId: profile.id,
        result: 'allowed',
        metadata: { ip: request.ip, via: 'reset_token' },
      })

      return reply.status(200).send({
        success: true,
        data: { message: 'Пароль змінено. Увійдіть з новим паролем.' },
      })
    }
  )

  return Promise.resolve()
}

export default resetPasswordRoute
