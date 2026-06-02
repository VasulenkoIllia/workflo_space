import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, changePasswordSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { hashPassword, verifyPassword } from '../../auth/password.js'
import { writeAuditAsync } from '../../services/audit.js'

/**
 * PATCH /profile/password — change password while authenticated.
 *
 * Verifies the current password, sets the new hash, and revokes ALL refresh
 * tokens (sign out everywhere — standard hygiene). The current access token
 * stays valid until it expires (≤15m).
 */
const changePasswordRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch(
    '/profile/password',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const input = changePasswordSchema.parse(request.body)
      const profileId = request.user.sub

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true, passwordHash: true },
      })
      if (!profile) {
        throw new AppError(ApiErrorCode.UNAUTHORIZED, 'Сесія недійсна', 401)
      }

      const ok = await verifyPassword(input.currentPassword, profile.passwordHash)
      if (!ok) {
        writeAuditAsync(request.log, {
          actorId: profileId,
          action: 'profile.password_change_failed',
          resourceType: 'profile',
          resourceId: profileId,
          result: 'denied',
          metadata: { reason: 'bad_current_password', ip: request.ip },
        })
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Поточний пароль невірний', 400)
      }

      const passwordHash = await hashPassword(input.newPassword)

      await tenantTransaction(prisma, async (tx) => {
        await tx.profile.update({ where: { id: profileId }, data: { passwordHash } })
        await tx.refreshToken.updateMany({
          where: { profileId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      })

      writeAuditAsync(request.log, {
        actorId: profileId,
        action: 'auth.password_changed',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { ip: request.ip, via: 'self_service' },
      })

      return reply.status(200).send({
        success: true,
        data: { message: 'Пароль змінено. Інші сесії завершено.' },
      })
    }
  )

  return Promise.resolve()
}

export default changePasswordRoute
