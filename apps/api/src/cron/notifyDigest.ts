import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { dispatchNotification } from '../services/notifications.js'

/**
 * S12-06 notify-digest (годинний тік, шле раз на добу о 8-й Kyiv): юзерам з
 * digestDaily=true — один email зі списком in-app сповіщень, накопичених від
 * lastDigestAt (перший раз — за 24h). Порожньо → лист не шлеться, але lastDigestAt
 * зсувається (наступний дайджест не тягне давнє). Ідемпотентність доби —
 * lastDigestAt >= сьогоднішня 8-та не шлеться вдруге.
 */
const INTERVAL_MS = 60 * 60 * 1000
const DIGEST_HOUR_KYIV = 8
const MAX_ROWS = 30

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

function kyivHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Kyiv',
    }).format(now)
  )
}

export async function runNotifyDigestOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  if (kyivHour(now) !== DIGEST_HOUR_KYIV) return 0
  return runWithSystemContext(async () => {
    // «Сьогоднішня 8-та» як anchor ідемпотентності: слали після неї — пропускаємо.
    const anchor = new Date(now.getTime() - 55 * 60 * 1000) // початок поточної години з запасом
    const targets = await prisma.notificationSettings.findMany({
      where: {
        digestDaily: true,
        OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: anchor } }],
      },
      select: { id: true, profileId: true, lastDigestAt: true },
      take: 500,
    })
    if (targets.length === 0) return 0

    let sent = 0
    for (const t of targets) {
      const since = t.lastDigestAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const items = await prisma.notification.findMany({
        where: { profileId: t.profileId, createdAt: { gt: since, lte: now } },
        orderBy: { createdAt: 'asc' },
        select: { title: true, body: true },
        take: MAX_ROWS + 1,
      })
      // Порожньо — лише зсуваємо маркер, листа нема
      await prisma.notificationSettings.update({
        where: { id: t.id },
        data: { lastDigestAt: now },
      })
      if (items.length === 0) continue
      const overflow = items.length > MAX_ROWS
      const rows: [string, string][] = items
        .slice(0, MAX_ROWS)
        .map((n) => [n.title, n.body] as [string, string])
      if (overflow) rows.push(['…', 'та інші — повний список у застосунку'])
      dispatchNotification(logger, {
        profileId: t.profileId,
        event: 'system.digest',
        vars: { count: items.length, rows },
      })
      sent += 1
    }
    logger.info({ targets: targets.length, sent }, 'notifyDigest: digests dispatched')
    return sent
  })
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    await runNotifyDigestOnce(logger)
  } catch (err) {
    logger.error({ err }, 'notifyDigest: run failed')
    captureException(err, { scope: 'cron.notifyDigest' })
  } finally {
    running = false
  }
}

export function startNotifyDigestCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), INTERVAL_MS)
    intervalTimer.unref()
  }, 150_000)
  bootTimer.unref()
}

export function stopNotifyDigestCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
