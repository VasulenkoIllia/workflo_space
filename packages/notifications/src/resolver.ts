import {
  CHANNELS,
  CRITICAL_EVENTS,
  EVENT_TO_CATEGORY,
  NotificationChannel,
  type NotificationEvent,
} from '@workflo/types'

/**
 * Minimal Prisma-like interface for the resolver — keeps this module
 * decoupled from the actual PrismaClient (the API layer injects it).
 */
export interface ResolverPrisma {
  notificationPreference: {
    findMany: (args: {
      where: { settingsId: string; category: string; enabled?: boolean; channel?: { in: string[] } }
      select?: { channel: true; enabled?: true }
    }) => Promise<Array<{ channel: string; enabled?: boolean }>>
  }
}

/**
 * Decide which channels to dispatch on for a given (settings, event) pair.
 * Pipeline (see ADR-003):
 *   1. Look up category from EVENT_TO_CATEGORY.
 *   2. Fetch enabled preference rows for that category.
 *   3. Filter to only globally-enabled channels (CHANNELS[c].enabled).
 *   4. If event is in CRITICAL_EVENTS, force-add 'email' regardless of prefs.
 *
 * Result is deduplicated and stable-ordered: email first, then telegram, then in_app, etc.
 */
export async function resolveTargetChannels(
  prisma: ResolverPrisma,
  settingsId: string,
  event: NotificationEvent
): Promise<ReadonlyArray<NotificationChannel>> {
  const category = EVENT_TO_CATEGORY[event]
  const isCritical = CRITICAL_EVENTS.includes(event)

  // Тягнемо ВСІ рядки категорії (не лише enabled), щоб відрізнити «категорію ще не
  // конфігуровано» (жодного рядка — новий модуль для наявного користувача) від «усе
  // вимкнено вручну». Перше → дефолт IN_APP (нова категорія не має мовчки зникати);
  // друге → поважаємо вибір (0 каналів).
  const prefs = await prisma.notificationPreference.findMany({
    where: { settingsId, category },
    select: { channel: true, enabled: true },
  })

  const userChannels = new Set<NotificationChannel>()
  if (prefs.length === 0) {
    userChannels.add(NotificationChannel.IN_APP)
  } else {
    for (const p of prefs) {
      const ch = p.channel as NotificationChannel
      if (p.enabled && CHANNELS[ch]?.enabled) {
        userChannels.add(ch)
      }
    }
  }

  if (isCritical) {
    // Email cannot be opted out for critical events.
    userChannels.add(NotificationChannel.EMAIL)
  }

  return CHANNEL_ORDER.filter((c) => userChannels.has(c))
}

const CHANNEL_ORDER: ReadonlyArray<NotificationChannel> = [
  NotificationChannel.EMAIL,
  NotificationChannel.TELEGRAM,
  NotificationChannel.IN_APP,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WEBHOOK,
]
