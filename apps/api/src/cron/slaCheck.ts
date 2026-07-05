import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { dispatchNotification } from '../services/notifications.js'

/**
 * Cron C-sla_check (S10-02, кожні 15 хв): активні замовлення з простроченим
 * first-response (команда ще не відповіла) АБО resolution (не done) → slaBreachedAt +
 * in-app ескалація власникам агенції (orders.sla_breached). Один breach на замовлення —
 * повторні прогони його не дублюють (slaBreachedAt у where).
 */
const INTERVAL_MS = 15 * 60 * 1000

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

export async function runSlaCheckOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  return runWithSystemContext(async () => {
    const breached = await prisma.order.findMany({
      where: {
        deletedAt: null,
        slaBreachedAt: null,
        internalStatus: { notIn: ['done', 'cancelled'] },
        OR: [
          { firstRespondedAt: null, firstResponseDueAt: { not: null, lt: now } },
          { resolutionDueAt: { not: null, lt: now } },
        ],
      },
      select: {
        id: true,
        agencyId: true,
        title: true,
        firstRespondedAt: true,
        firstResponseDueAt: true,
        resolutionDueAt: true,
      },
      take: 200,
    })
    if (breached.length === 0) return 0

    const agencyIds = [...new Set(breached.map((o) => o.agencyId))]
    const owners = await prisma.agencyMember.findMany({
      where: { agencyId: { in: agencyIds }, role: 'owner' },
      select: { agencyId: true, profileId: true },
    })
    const ownersByAgency = new Map<string, string[]>()
    for (const o of owners) {
      ownersByAgency.set(o.agencyId, [...(ownersByAgency.get(o.agencyId) ?? []), o.profileId])
    }

    for (const order of breached) {
      const firstResponseBreached =
        order.firstRespondedAt === null &&
        order.firstResponseDueAt !== null &&
        order.firstResponseDueAt < now
      const kind = firstResponseBreached ? 'першої відповіді' : 'розв’язання'
      for (const profileId of ownersByAgency.get(order.agencyId) ?? []) {
        dispatchNotification(logger, {
          profileId,
          event: 'orders.sla_breached',
          vars: { orderId: order.id, kind },
          inApp: {
            title: `SLA порушено: «${order.title}»`,
            body: `Минув термін ${kind}. Перевірте замовлення і відповідальних.`,
          },
        })
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { slaBreachedAt: now },
      })
    }
    logger.warn({ breached: breached.length }, 'slaCheck: SLA breaches escalated')
    return breached.length
  })
}

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    await runSlaCheckOnce(logger)
  } catch (err) {
    logger.error({ err }, 'slaCheck: run failed')
    captureException(err, { scope: 'cron.slaCheck' })
  } finally {
    running = false
  }
}

export function startSlaCheckCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), INTERVAL_MS)
    intervalTimer.unref()
  }, 90_000)
  bootTimer.unref()
}

export function stopSlaCheckCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
