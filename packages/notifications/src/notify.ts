import { NotificationChannel, type NotificationEvent } from '@workflo/types'
import {
  dispatchEmail,
  dispatchInApp,
  dispatchTelegram,
  type DispatchResult,
  type Recipient,
} from './dispatch.js'
export type { Recipient } from './dispatch.js'
import { resolveTargetChannels, type ResolverPrisma } from './resolver.js'

/**
 * Minimal Prisma-shape DI surface — full PrismaClient extends this, but
 * tests can pass any matching object. Only the methods we actually call
 * are typed.
 */
export interface NotifyPrisma extends ResolverPrisma {
  notificationSettings: {
    findUnique: (args: { where: { profileId: string }; select?: Record<string, true> }) => Promise<{
      id: string
      profileId: string
      language: string
      telegramChatId: string | null
    } | null>
  }
  profile: {
    findUnique: (args: {
      where: { id: string }
      select?: Record<string, true>
    }) => Promise<{ id: string; email: string; name: string; language: string } | null>
  }
  notificationLog: {
    create: (args: {
      data: {
        settingsId: string
        event: string
        channel: string
        status: string
        errorCode?: string | null
        metadata?: unknown
      }
    }) => Promise<unknown>
  }
  notification: {
    create: (args: {
      data: {
        profileId: string
        type: string
        title: string
        body: string
        metadata?: unknown
      }
    }) => Promise<unknown>
  }
}

export interface NotifyLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void
  warn: (msg: string, meta?: Record<string, unknown>) => void
  error: (msg: string, meta?: Record<string, unknown>) => void
}

const defaultLogger: NotifyLogger = {
  info: (msg, meta) => {
    // eslint-disable-next-line no-console
    process.stdout.write(`[notify] INFO  ${msg} ${meta ? JSON.stringify(meta) : ''}\n`)
  },
  warn: (msg, meta) => {
    process.stdout.write(`[notify] WARN  ${msg} ${meta ? JSON.stringify(meta) : ''}\n`)
  },
  error: (msg, meta) => {
    process.stderr.write(`[notify] ERROR ${msg} ${meta ? JSON.stringify(meta) : ''}\n`)
  },
}

export interface NotifyDeps {
  prisma: NotifyPrisma
  logger?: NotifyLogger
  /**
   * Called when Telegram returns `blocked` for a recipient — used by API layer
   * to auto-disable the telegram channel for that user.
   */
  onTelegramBlocked?: (profileId: string) => Promise<void> | void
}

export interface NotifyInput {
  /** Profile id of the recipient. Settings + language are loaded from DB. */
  profileId: string
  /** Event identifier — drives both resolver and renderer. */
  event: NotificationEvent
  /** Event-specific variables passed to the renderer. */
  vars: Record<string, unknown>
  /**
   * Optional in_app title/body — when omitted, in_app dispatch is skipped.
   * (We don't auto-derive in_app text from email/telegram templates because
   * those are rich HTML — in_app needs plain compact text.)
   */
  inApp?: { title: string; body: string }
}

export interface NotifyOutcome {
  /** All channels we resolved + their dispatch results. */
  results: ReadonlyArray<DispatchResult>
  /** Channels actually attempted (excludes skipped-empty). */
  attempted: ReadonlyArray<NotificationChannel>
}

/**
 * Main notification entry point.
 *
 * Flow:
 *   1. Load profile + notification settings.
 *   2. resolveTargetChannels() → which channels to dispatch on.
 *   3. For each channel: render + dispatch + log to notification_logs.
 *   4. Side effects:
 *      - Telegram blocked → invoke onTelegramBlocked callback,
 *      - in_app dispatch → write a Notification row directly.
 *
 * Never throws — collects per-channel failures into `results` so callers can
 * decide whether to retry / surface a warning to the user.
 */
export async function notify(deps: NotifyDeps, input: NotifyInput): Promise<NotifyOutcome> {
  const logger = deps.logger ?? defaultLogger
  const { prisma } = deps

  const settings = await prisma.notificationSettings.findUnique({
    where: { profileId: input.profileId },
    select: { id: true, profileId: true, language: true, telegramChatId: true },
  })

  if (!settings) {
    logger.warn('notify.no_settings', { profileId: input.profileId, event: input.event })
    return { results: [], attempted: [] }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: input.profileId },
    select: { id: true, email: true, name: true, language: true },
  })

  if (!profile) {
    logger.warn('notify.no_profile', { profileId: input.profileId, event: input.event })
    return { results: [], attempted: [] }
  }

  const recipient: Recipient = {
    email: profile.email,
    name: profile.name,
    telegramChatId: settings.telegramChatId,
    locale: (settings.language as 'uk' | 'en') ?? 'uk',
  }

  const channels = await resolveTargetChannels(prisma, settings.id, input.event)

  const results: DispatchResult[] = []
  const attempted: NotificationChannel[] = []

  for (const channel of channels) {
    attempted.push(channel)
    let result: DispatchResult

    if (channel === NotificationChannel.EMAIL) {
      result = await dispatchEmail(input.event, recipient, input.vars)
    } else if (channel === NotificationChannel.TELEGRAM) {
      result = await dispatchTelegram(input.event, recipient, input.vars)
      if (
        result.channel === NotificationChannel.TELEGRAM &&
        result.result.status === 'failed' &&
        result.result.reason === 'blocked'
      ) {
        try {
          await deps.onTelegramBlocked?.(input.profileId)
        } catch (cbErr) {
          logger.error('notify.onTelegramBlocked_failed', {
            profileId: input.profileId,
            error: cbErr instanceof Error ? cbErr.message : String(cbErr),
          })
        }
      }
    } else if (channel === NotificationChannel.IN_APP) {
      result = dispatchInApp(input.event, recipient, input.vars)
      if (input.inApp) {
        try {
          await prisma.notification.create({
            data: {
              profileId: input.profileId,
              type: input.event,
              title: input.inApp.title,
              body: input.inApp.body,
              metadata: input.vars as object,
            },
          })
          result = {
            channel: NotificationChannel.IN_APP,
            result: { status: 'skipped', reason: 'persisted_in_app_row' },
          }
        } catch (err) {
          logger.error('notify.in_app_persist_failed', {
            profileId: input.profileId,
            event: input.event,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } else {
      // sms / push / webhook — channel is enabled by user pref but adapter not
      // shipped yet. Resolver should already filter these via CHANNELS[c].enabled,
      // so this is defensive only.
      result = {
        channel,
        result: { status: 'skipped', reason: 'adapter_not_implemented' },
      }
    }

    results.push(result)

    // Persist to notification_logs (never blocks the rest of the dispatch).
    try {
      await prisma.notificationLog.create({
        data: {
          settingsId: settings.id,
          event: input.event,
          channel,
          status: result.result.status,
          errorCode: 'reason' in result.result ? result.result.reason : null,
          metadata: { vars: input.vars },
        },
      })
    } catch (logErr) {
      logger.error('notify.log_persist_failed', {
        profileId: input.profileId,
        event: input.event,
        channel,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      })
    }
  }

  return { results, attempted }
}

export interface NotifyRecipientInput {
  /** Explicit recipient — used when there is no Profile (external guest, invite). */
  recipient: Recipient
  event: NotificationEvent
  vars: Record<string, unknown>
  /** Channels to dispatch on. Defaults to email only (the always-available channel). */
  channels?: ReadonlyArray<NotificationChannel>
}

/**
 * Profile-less dispatch (audit D2). Sends to an explicit Recipient without
 * loading NotificationSettings / preferences — for recipients who don't (yet)
 * have a Profile: invite emails, calendar external guests, one-off transactional
 * sends. No DB access, no notification_logs row (no settingsId to attach).
 *
 * Never throws — per-channel failures are collected in the returned results.
 */
export async function notifyRecipient(
  input: NotifyRecipientInput,
  logger: NotifyLogger = defaultLogger
): Promise<NotifyOutcome> {
  const channels = input.channels ?? [NotificationChannel.EMAIL]
  const results: DispatchResult[] = []
  const attempted: NotificationChannel[] = []

  for (const channel of channels) {
    attempted.push(channel)
    if (channel === NotificationChannel.EMAIL) {
      results.push(await dispatchEmail(input.event, input.recipient, input.vars))
    } else if (channel === NotificationChannel.TELEGRAM) {
      results.push(await dispatchTelegram(input.event, input.recipient, input.vars))
    } else {
      logger.warn('notifyRecipient.unsupported_channel', { channel, event: input.event })
      results.push({ channel, result: { status: 'skipped', reason: 'unsupported_for_recipient' } })
    }
  }

  return { results, attempted }
}
