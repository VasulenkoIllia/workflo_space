import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { dispatchNotification } from '../services/notifications.js'

/**
 * Cron C-calendar_reminder (24 MVP, кожні 15 хв): нагадування учасникам за ~1 год до
 * зустрічі. Ідемпотентність — вікно [now+45хв; now+60хв]: подія потрапляє рівно в один
 * прогін (крок 15хв < ширина вікна 15хв). Скасовані/минулі — пропускаються.
 */
const INTERVAL_MS = 15 * 60 * 1000
const BOOT_DELAY_MS = 60 * 1000

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

function fmtTime(d: Date, tz: string): string {
  try {
    return d.toLocaleString('uk-UA', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return d.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })
  }
}

export async function runCalendarReminderOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  return runWithSystemContext(async () => {
    const windowStart = new Date(now.getTime() + 45 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 60 * 60 * 1000)
    const events = await prisma.calendarEvent.findMany({
      where: { cancelledAt: null, startsAt: { gte: windowStart, lte: windowEnd } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        timezone: true,
        createdById: true,
        attendees: { select: { profileId: true } },
      },
      take: 200,
    })
    if (events.length === 0) return 0

    let sent = 0
    for (const ev of events) {
      const recipients = new Set([ev.createdById, ...ev.attendees.map((a) => a.profileId)])
      for (const profileId of recipients) {
        dispatchNotification(logger, {
          profileId,
          event: 'calendar.reminder',
          vars: { title: ev.title, startsAt: ev.startsAt.toISOString(), eventId: ev.id },
          inApp: {
            title: 'Нагадування про зустріч',
            body: `${ev.title} — ${fmtTime(ev.startsAt, ev.timezone)}`,
          },
        })
        sent += 1
      }
    }
    return sent
  })
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    const sent = await runCalendarReminderOnce(logger)
    if (sent > 0) logger.info({ sent }, 'calendar-reminder: run complete')
  } catch (err) {
    captureException(err, { cron: 'calendar_reminder' })
    logger.error({ err }, 'calendar-reminder: run failed')
  } finally {
    running = false
  }
}

export function startCalendarReminderCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), INTERVAL_MS)
    intervalTimer.unref()
  }, BOOT_DELAY_MS)
  bootTimer.unref()
}

export function stopCalendarReminderCron(): void {
  if (bootTimer) clearTimeout(bootTimer)
  if (intervalTimer) clearInterval(intervalTimer)
  bootTimer = null
  intervalTimer = null
}
