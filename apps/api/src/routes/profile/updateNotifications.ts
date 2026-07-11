import { prisma, tenantTransaction } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  NotificationCategory,
  NotificationChannel,
  updateNotificationPreferencesSchema,
} from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
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

      // Upsert (not findUnique-or-404): a profile that never got a settings row provisioned
      // must still be able to set preferences — create the row on first save.
      const settings = await prisma.notificationSettings.upsert({
        where: { profileId },
        create: { profileId },
        update: {},
        select: { id: true },
      })

      // Upsert each (category, channel) row. Sequential keeps it simple and the
      // payload is bounded (≤42 rows by schema).
      await tenantTransaction(prisma, async (tx) => {
        for (const p of input.preferences) {
          await tx.notificationPreference.upsert({
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
        }
      })

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

  // GET — load the current (category × channel) matrix so the settings UI can render toggles.
  // S12-06: + тихі години і дайджест (рендеряться тією ж секцією налаштувань).
  fastify.get(
    '/profile/notifications',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const settings = await prisma.notificationSettings.findUnique({
        where: { profileId: request.user.sub },
        select: { id: true, quietFrom: true, quietTo: true, digestDaily: true },
      })
      const preferences = settings
        ? await prisma.notificationPreference.findMany({
            where: { settingsId: settings.id },
            select: { category: true, channel: true, enabled: true },
            orderBy: [{ category: 'asc' }, { channel: 'asc' }],
          })
        : []
      return reply.send({
        success: true,
        data: {
          preferences,
          quietFrom: settings?.quietFrom ?? null,
          quietTo: settings?.quietTo ?? null,
          digestDaily: settings?.digestDaily ?? false,
        },
      })
    }
  )

  // S12-06: тихі години (Kyiv) + ранковий email-дайджест. quietFrom/quietTo разом
  // (обидва або null); in_app тихі години не чіпають — лише email/telegram/push.
  const quietSchema = z
    .object({
      quietFrom: z.number().int().min(0).max(23).nullable().optional(),
      quietTo: z.number().int().min(0).max(23).nullable().optional(),
      digestDaily: z.boolean().optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: 'Порожній запит' })
    .refine((d) => (d.quietFrom == null) === (d.quietTo == null), {
      message: 'quietFrom і quietTo — разом (обидва або жодного)',
    })

  fastify.patch(
    '/profile/notification-settings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const input = quietSchema.parse(request.body)
      const settings = await prisma.notificationSettings.upsert({
        where: { profileId: request.user.sub },
        create: {
          profileId: request.user.sub,
          quietFrom: input.quietFrom ?? null,
          quietTo: input.quietTo ?? null,
          digestDaily: input.digestDaily ?? false,
        },
        update: {
          ...(input.quietFrom !== undefined ? { quietFrom: input.quietFrom } : {}),
          ...(input.quietTo !== undefined ? { quietTo: input.quietTo } : {}),
          ...(input.digestDaily !== undefined ? { digestDaily: input.digestDaily } : {}),
        },
        select: { quietFrom: true, quietTo: true, digestDaily: true },
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        action: 'notifications.quiet_settings_updated',
        resourceType: 'profile',
        resourceId: request.user.sub,
        result: 'allowed',
        metadata: input,
      })
      return reply.send({ success: true, data: settings })
    }
  )

  return Promise.resolve()
}

export default updateNotificationsRoute
