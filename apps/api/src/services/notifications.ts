import { prisma } from '@workflo/db'
import { type NotifyDeps, type NotifyInput, notify } from '@workflo/notifications'
import type { FastifyBaseLogger } from 'fastify'
import { writeAuditAsync } from './audit.js'

/**
 * Build NotifyDeps wired to the app's Prisma client.
 *
 * onTelegramBlocked: when Telegram reports a recipient blocked the bot, disable
 * the telegram channel across all categories for that profile's settings — the
 * single auto-disable in the system (see modules/07-notifications.md §10).
 */
export function buildNotifyDeps(logger: FastifyBaseLogger): NotifyDeps {
  return {
    // The package only depends on a structural subset of PrismaClient.
    prisma: prisma as unknown as NotifyDeps['prisma'],
    logger: {
      info: (msg, meta) => logger.info(meta ?? {}, msg),
      warn: (msg, meta) => logger.warn(meta ?? {}, msg),
      error: (msg, meta) => logger.error(meta ?? {}, msg),
    },
    onTelegramBlocked: async (profileId) => {
      const settings = await prisma.notificationSettings.findUnique({
        where: { profileId },
        select: { id: true },
      })
      if (!settings) return
      await prisma.notificationPreference.updateMany({
        where: { settingsId: settings.id, channel: 'telegram' },
        data: { enabled: false },
      })
      writeAuditAsync(logger, {
        actorId: profileId,
        action: 'notifications.telegram_auto_disabled',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { reason: 'blocked_by_user' },
      })
    },
  }
}

/**
 * Fire-and-forget dispatch — never throws into the request path. Errors are
 * logged; delivery failures are already captured in notification_logs by notify().
 */
export function dispatchNotification(logger: FastifyBaseLogger, input: NotifyInput): void {
  const deps = buildNotifyDeps(logger)
  void notify(deps, input).catch((err: unknown) => {
    logger.error({ err, event: input.event, profileId: input.profileId }, 'notify dispatch failed')
  })
}
