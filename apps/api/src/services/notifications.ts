import { type Prisma, prisma, withTenant } from '@workflo/db'
import { type NotifyDeps, type NotifyInput, notify } from '@workflo/notifications'
import type { NotificationEvent } from '@workflo/types'
import type { FastifyBaseLogger } from 'fastify'
import { writeAuditAsync } from './audit.js'
import { resolveEmailOverrides } from './emailTemplates.js'

/**
 * AR-24 (audit 2026-06-11): the notifications package does its own DB I/O, but it
 * must never run on the raw client — every call routes through `withTenant`, which
 * sets the RLS GUC from the AMBIENT AsyncLocalStorage context (request → tenant
 * GUC; outbox worker → system bypass via runWithSystemContext). Today the notify
 * surface touches only profile-scoped tables (no RLS policies), but this seam keeps
 * the package correct the day a tenant table joins the surface — and keeps it from
 * tripping the AR-23 fail-closed guard from an unbound context once RLS_ENFORCED
 * flips (notify is always called from a request or worker context).
 */
const tenantScopedNotifyDb = {
  notificationSettings: {
    findUnique: (args: { where: { profileId: string } }) =>
      withTenant((tx) =>
        tx.notificationSettings.findUnique({
          where: args.where,
          // S12-06: quietFrom/quietTo — без них notify не бачить тихі години
          select: {
            id: true,
            profileId: true,
            language: true,
            telegramChatId: true,
            quietFrom: true,
            quietTo: true,
          },
        })
      ),
  },
  profile: {
    findUnique: (args: { where: { id: string } }) =>
      withTenant((tx) =>
        tx.profile.findUnique({
          where: args.where,
          select: { id: true, email: true, name: true, language: true },
        })
      ),
  },
  notificationLog: {
    create: (args: { data: Prisma.NotificationLogUncheckedCreateInput }) =>
      withTenant((tx) => tx.notificationLog.create({ data: args.data })),
  },
  notification: {
    create: (args: { data: Prisma.NotificationUncheckedCreateInput }) =>
      withTenant((tx) => tx.notification.create({ data: args.data })),
  },
  notificationPreference: {
    findMany: (args: {
      where: { settingsId: string; category: string; enabled?: boolean; channel?: { in: string[] } }
      select?: { channel: true }
    }) =>
      withTenant((tx) =>
        // Pass the caller's select through (review fix) — a hardcoded shape would
        // silently return undefined for any field the package adds later.
        tx.notificationPreference.findMany({
          where: args.where,
          select: args.select ?? { channel: true },
        })
      ),
  },
} as unknown as NotifyDeps['prisma']

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
    prisma: tenantScopedNotifyDb,
    logger: {
      info: (msg, meta) => logger.info(meta ?? {}, msg),
      warn: (msg, meta) => logger.warn(meta ?? {}, msg),
      error: (msg, meta) => logger.error(meta ?? {}, msg),
    },
    onTelegramBlocked: async (profileId) => {
      const settings = await withTenant((tx) =>
        tx.notificationSettings.findUnique({
          where: { profileId },
          select: { id: true },
        })
      )
      if (!settings) return
      await withTenant((tx) =>
        tx.notificationPreference.updateMany({
          where: { settingsId: settings.id, channel: 'telegram' },
          data: { enabled: false },
        })
      )
      writeAuditAsync(logger, {
        actorId: profileId,
        action: 'notifications.telegram_auto_disabled',
        resourceType: 'profile',
        resourceId: profileId,
        result: 'allowed',
        metadata: { reason: 'blocked_by_user' },
      })
    },
    // S12-03: підписки — identity-scoped (як refresh_tokens), читаються raw prisma.
    pushSubscriptions: {
      list: async (profileId) =>
        prisma.pushSubscription.findMany({
          where: { profileId },
          select: { endpoint: true, p256dh: true, auth: true },
        }),
      removeByEndpoint: async (endpoint) => {
        await prisma.pushSubscription.deleteMany({ where: { endpoint } })
      },
    },
  }
}

/**
 * Fire-and-forget dispatch — never throws into the request path. Errors are
 * logged; delivery failures are already captured in notification_logs by notify().
 */
export function dispatchNotification<E extends NotificationEvent>(
  logger: FastifyBaseLogger,
  input: NotifyInput<E>
): void {
  const deps = buildNotifyDeps(logger)
  void (async () => {
    // 08-EMAIL: owner-override теми/вступу (лише бізнес-події; збій резолву не валить лист)
    const emailOverrides =
      input.emailOverrides ??
      (await resolveEmailOverrides(input.profileId, input.event).catch(() => undefined))
    await notify(deps, { ...input, emailOverrides })
  })().catch((err: unknown) => {
    logger.error({ err, event: input.event, profileId: input.profileId }, 'notify dispatch failed')
  })
}
