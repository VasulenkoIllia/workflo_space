import { prisma } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  NotificationCategory,
  NotificationChannel,
  updateNotificationPreferencesSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'

// ADR-003: email for auth + billing is locked ON (critical events). The
// resolver forces it regardless, so we reject attempts to disable it to keep
// the UI lock and the stored state consistent.
const LOCKED_EMAIL_CATEGORIES: ReadonlyArray<string> = [
  NotificationCategory.AUTH,
  NotificationCategory.BILLING,
]

/** PATCH /profile/notifications — bulk-update the (category × channel) matrix. */
const updateNotificationsRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch(
    '/profile/notifications',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = updateNotificationPreferencesSchema.parse(request.body)
      const profileId = request.user.sub

      // Reject disabling locked critical-email prefs.
      const locked = input.preferences.find(
        (p) =>
          p.channel === NotificationChannel.EMAIL &&
          LOCKED_EMAIL_CATEGORIES.includes(p.category) &&
          p.enabled === false
      )
      if (locked) {
        throw new AppError(
          ApiErrorCode.VALIDATION_ERROR,
          `Email для категорії "${locked.category}" не можна вимкнути — це критичні події (ADR-003)`,
          400
        )
      }

      const settings = await prisma.notificationSettings.findUnique({
        where: { profileId },
        select: { id: true },
      })
      if (!settings) {
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Налаштування нотифікацій не знайдено', 404)
      }

      // Upsert each (category, channel) row. Sequential keeps it simple and the
      // payload is bounded (≤42 rows by schema).
      await prisma.$transaction(
        input.preferences.map((p) =>
          prisma.notificationPreference.upsert({
            where: {
              settingsId_category_channel: {
                settingsId: settings.id,
                category: p.category,
                channel: p.channel,
              },
            },
            update: { enabled: p.enabled },
            create: {
              settingsId: settings.id,
              category: p.category,
              channel: p.channel,
              enabled: p.enabled,
            },
          })
        )
      )

      writeAuditAsync(request.log, {
        actorId: profileId,
        action: 'profile.notifications_updated',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { count: input.preferences.length },
      })

      const preferences = await prisma.notificationPreference.findMany({
        where: { settingsId: settings.id },
        select: { category: true, channel: true, enabled: true },
        orderBy: [{ category: 'asc' }, { channel: 'asc' }],
      })

      return reply.status(200).send({ success: true, data: { preferences } })
    }
  )

  return Promise.resolve()
}

export default updateNotificationsRoute
