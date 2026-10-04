import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { computeLeadSourceReport } from '../services/leadSourceReport.js'
import { computeSlaReport } from '../services/slaReport.js'
import { dispatchNotification } from '../services/notifications.js'
import { makeCron } from './makeCron.js'

/**
 * Cron C-monthly_report (S11, раз на добу): агенціям з увімкненим monthlyReportEnabled
 * шле власникам email-дайджест за ПОПЕРЕДНІЙ календарний місяць (UTC-місяці — та сама
 * межа, що у звітах). Одна відправка на місяць гейтиться monthlyReportLastSentAt
 * (>= початку поточного місяця = уже слали). Щойно увімкнений тумблер → перший лист
 * прийде на наступному прогоні (за минулий місяць) — зручно для перевірки.
 */
const INTERVAL_MS = 24 * 60 * 60 * 1000

const isoDay = (d: Date): string => d.toISOString().slice(0, 10)

function fmtMoney(bag: Record<string, number>): string {
  const parts = Object.entries(bag).map(([cur, amt]) => `${amt} ${cur}`)
  return parts.length > 0 ? parts.join(' · ') : '0'
}

const fmtPct = (pct: number | null): string => (pct == null ? '—' : `${pct}%`)

export async function runMonthlyReportOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  return runWithSystemContext(async () => {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const prevEnd = new Date(monthStart.getTime() - 86_400_000) // останній день минулого місяця
    const from = isoDay(prevStart)
    const to = isoDay(prevEnd)
    const periodLabel = new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      year: 'numeric',
    }).format(prevStart)

    const agencies = await prisma.agency.findMany({
      where: {
        monthlyReportEnabled: true,
        OR: [{ monthlyReportLastSentAt: null }, { monthlyReportLastSentAt: { lt: monthStart } }],
      },
      select: { id: true, name: true },
      take: 100,
    })
    if (agencies.length === 0) return 0

    for (const agency of agencies) {
      // Числа дайджесту — ті самі сервіси, що живлять /workspace/reports/*.
      const [sla, leadSources, createdCount, hoursAgg, paidOrders] = await Promise.all([
        computeSlaReport(prisma, { agencyId: agency.id, from, to, now }),
        computeLeadSourceReport(prisma, { agencyId: agency.id, from, to }),
        prisma.order.count({
          where: {
            agencyId: agency.id,
            deletedAt: null,
            createdAt: { gte: prevStart, lt: monthStart },
          },
        }),
        prisma.timeLog.aggregate({
          where: { agencyId: agency.id, date: { gte: prevStart, lt: monthStart } },
          _sum: { hours: true },
        }),
        prisma.order.findMany({
          where: {
            agencyId: agency.id,
            deletedAt: null,
            paidAt: { gte: prevStart, lt: monthStart },
          },
          select: { totalAmount: true, fixedPrice: true, currency: true },
        }),
      ])

      const paid: Record<string, number> = {}
      for (const o of paidOrders) {
        const amount = Number(o.totalAmount ?? o.fixedPrice ?? 0)
        if (amount > 0)
          paid[o.currency] = Math.round(((paid[o.currency] ?? 0) + amount) * 100) / 100
      }
      const wonLeads = leadSources.rows.reduce((s, r) => s + r.won, 0)
      const topSource = leadSources.rows[0]

      const rows: [string, string][] = [
        ['Нових замовлень', String(createdCount)],
        ['Оплачено замовлень', `${paidOrders.length} (${fmtMoney(paid)})`],
        ['Годин залоговано', String(Number(hoursAgg._sum.hours ?? 0))],
        ['Лідів отримано', `${leadSources.totalLeads} (виграно: ${wonLeads})`],
        ['Топ-джерело лідів', topSource ? `${topSource.source} — ${topSource.leads} лідів` : '—'],
        ['SLA: перша відповідь', fmtPct(sla.firstResponse.compliancePct)],
        ['SLA: розв’язання', fmtPct(sla.resolution.compliancePct)],
        ['SLA-порушень у вікні', String(sla.breachedOrders.length)],
      ]

      const owners = await prisma.agencyMember.findMany({
        where: { agencyId: agency.id, role: 'owner' },
        select: { profileId: true },
      })
      for (const owner of owners) {
        dispatchNotification(logger, {
          profileId: owner.profileId,
          event: 'reports.monthly',
          vars: { periodLabel, rows },
          inApp: {
            title: `Місячний звіт — ${periodLabel}`,
            body: `Замовлень: ${createdCount} · лідів: ${leadSources.totalLeads} · SLA перша відповідь: ${fmtPct(sla.firstResponse.compliancePct)}`,
          },
        })
      }

      await prisma.agency.update({
        where: { id: agency.id },
        data: { monthlyReportLastSentAt: now },
      })
    }

    logger.info({ agencies: agencies.length }, 'monthlyReport: digests dispatched')
    return agencies.length
  })
}

const cron = makeCron({
  name: 'monthlyReport',
  bootDelayMs: 120_000,
  intervalMs: INTERVAL_MS,
  run: (logger) => runMonthlyReportOnce(logger),
})
export const startMonthlyReportCron = cron.start
export const stopMonthlyReportCron = cron.stop
