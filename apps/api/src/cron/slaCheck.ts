import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { dispatchNotification } from '../services/notifications.js'
import { makeCron } from './makeCron.js'

/**
 * Cron C-sla_check (S10-02, кожні 15 хв): активні замовлення з простроченим
 * first-response (команда ще не відповіла) АБО resolution (не done) → slaBreachedAt +
 * in-app ескалація власникам агенції (orders.sla_breached). Один breach на замовлення —
 * повторні прогони його не дублюють (slaBreachedAt у where).
 */
const INTERVAL_MS = 15 * 60 * 1000

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

const cron = makeCron({
  name: 'slaCheck',
  bootDelayMs: 90_000,
  intervalMs: INTERVAL_MS,
  run: (logger) => runSlaCheckOnce(logger),
})
export const startSlaCheckCron = cron.start
export const stopSlaCheckCron = cron.stop
