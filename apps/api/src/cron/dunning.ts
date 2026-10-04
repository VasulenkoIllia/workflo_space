import { type Prisma, prisma, runWithSystemContext } from '@workflo/db'
import { notify } from '@workflo/notifications'
import type { FastifyBaseLogger } from 'fastify'
import { resolveEmailOverrides } from '../services/emailTemplates.js'
import { buildNotifyDeps } from '../services/notifications.js'
import { makeCron } from './makeCron.js'

/**
 * Cron C-dunning (05-Б, рішення власника 07.07): нагадування про оплату по
 * НАРАХУВАННЯХ (ServiceCharge.dueDate), email + in-app через notify-пайплайн.
 *
 *  1. Overdue-маркування (закриває B-D1 «вічно pending»): pending/partial з
 *     dueDate у минулому і додатним боргом → status=overdue. Ставиться ЗАВЖДИ,
 *     незалежно від opt-out — вимикач глушить лише листи.
 *  2. Ланцюжок кроків: офсети в днях від dueDate (Agency.dunningSteps; null →
 *     DEFAULT_DUNNING_STEPS, [] → дунінг вимкнено). Надсилається лише ОСТАННІЙ
 *     насталий крок (catch-up без спаму); ідемпотентність — DunningLog
 *     @@unique([chargeId, stepOffset]). На фінальному кроці — ескалація власникам
 *     (billing.invoice_overdue), позначається escalatedAt на тому ж лог-рядку.
 *
 * Драфти on_actuals (approvalStatus=pending/rejected) — не борг, пропускаються.
 */
export const DEFAULT_DUNNING_STEPS = [-3, 0, 3, 7, 14]

const INTERVAL_MS = 60 * 60 * 1000 // кроки «настають» протягом дня; ідемпотентно
const BOOT_DELAY_MS = 90 * 1000
const BATCH = 300
const DAY_MS = 24 * 60 * 60 * 1000

export function parseDunningSteps(raw: unknown): number[] {
  if (raw == null) return DEFAULT_DUNNING_STEPS
  if (!Array.isArray(raw)) return DEFAULT_DUNNING_STEPS
  const steps = raw
    .filter((x): x is number => typeof x === 'number' && Number.isInteger(x))
    .filter((x) => x >= -30 && x <= 60)
  return [...new Set(steps)].sort((a, b) => a - b)
}

function fmtAmount(amount: Prisma.Decimal, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })
}

export interface DunningRunResult {
  markedOverdue: number
  remindersSent: number
  escalations: number
}

export async function runDunningOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<DunningRunResult> {
  return runWithSystemContext(async () => {
    // 1) B-D1: доганяємо stale-статуси (та сама семантика, що deriveChargeState:
    // додатний борг + минулий dueDate; кредитні/нульові рядки не чіпаємо).
    // NULL-пастка SQL: NOT(col IN (...)) відкидає NULL-рядки, а approvalStatus
    // NULL = «без гейта, борг живий» — тому явний OR (null | approved).
    const owedWhere = {
      status: { in: ['pending', 'partial'] as ('pending' | 'partial')[] },
      dueDate: { not: null, lt: now },
      AND: [
        { OR: [{ totalAmount: { gt: 0 } }, { totalAmount: null, amount: { gt: 0 } }] },
        { OR: [{ approvalStatus: null }, { approvalStatus: 'approved' as const }] },
      ],
    }
    const marked = await prisma.serviceCharge.updateMany({
      where: owedWhere,
      data: { status: 'overdue' },
    })

    // 2) Кроки нагадувань. Найраніший офсет може бути відʼємним (upcoming) —
    // беремо нарахування з dueDate у вікні [now - 90д; now + 30д].
    const charges = await prisma.serviceCharge.findMany({
      where: {
        status: { in: ['pending', 'partial', 'overdue'] },
        dueDate: {
          not: null,
          gte: new Date(now.getTime() - 90 * DAY_MS),
          lte: new Date(now.getTime() + 30 * DAY_MS),
        },
        AND: [
          { OR: [{ totalAmount: { gt: 0 } }, { totalAmount: null, amount: { gt: 0 } }] },
          { OR: [{ approvalStatus: null }, { approvalStatus: 'approved' as const }] },
        ],
        company: { dunningOptOut: false },
      },
      select: {
        id: true,
        agencyId: true,
        companyId: true,
        dueDate: true,
        amount: true,
        totalAmount: true,
        currency: true,
        periodStart: true,
        periodEnd: true,
        company: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: BATCH,
    })
    if (charges.length === 0)
      return { markedOverdue: marked.count, remindersSent: 0, escalations: 0 }

    const agencyIds = [...new Set(charges.map((c) => c.agencyId))]
    const agencies = await prisma.agency.findMany({
      where: { id: { in: agencyIds } },
      select: { id: true, dunningSteps: true },
    })
    const stepsByAgency = new Map(agencies.map((a) => [a.id, parseDunningSteps(a.dunningSteps)]))

    const owners = await prisma.agencyMember.findMany({
      where: { agencyId: { in: agencyIds }, role: 'owner' },
      select: { agencyId: true, profileId: true },
    })
    const ownersByAgency = new Map<string, string[]>()
    for (const o of owners) {
      ownersByAgency.set(o.agencyId, [...(ownersByAgency.get(o.agencyId) ?? []), o.profileId])
    }

    const deps = buildNotifyDeps(logger)
    const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
    const workspaceUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
    let remindersSent = 0
    let escalations = 0

    for (const charge of charges) {
      const steps = stepsByAgency.get(charge.agencyId) ?? DEFAULT_DUNNING_STEPS
      if (steps.length === 0 || !charge.dueDate) continue

      // Останній настале крок — catch-up без розсилки всіх пропущених.
      const due = charge.dueDate.getTime()
      const arrived = steps.filter((offset) => due + offset * DAY_MS <= now.getTime())
      const stepOffset = arrived[arrived.length - 1]
      if (stepOffset === undefined) continue

      const already = await prisma.dunningLog.findUnique({
        where: { chargeId_stepOffset: { chargeId: charge.id, stepOffset } },
        select: { id: true },
      })
      if (already) continue

      const amountDue = fmtAmount(charge.totalAmount ?? charge.amount, charge.currency)
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - due) / DAY_MS))
      const phase = stepOffset < 0 ? 'upcoming' : stepOffset === 0 ? 'due' : 'overdue'
      const periodLabel =
        charge.periodStart && charge.periodEnd
          ? `${fmtDay(charge.periodStart)} — ${fmtDay(charge.periodEnd)}`
          : null

      // Лог ПЕРЕД відправкою: конкурентний прогін впирається в unique і не дублює.
      let log
      try {
        log = await prisma.dunningLog.create({
          data: { agencyId: charge.agencyId, chargeId: charge.id, stepOffset },
        })
      } catch {
        continue // паралельний воркер уже взяв цей крок
      }

      const members = await prisma.companyMember.findMany({
        where: { companyId: charge.companyId },
        select: { profileId: true },
      })
      for (const m of members) {
        const emailOverrides = await resolveEmailOverrides(
          m.profileId,
          'billing.payment_reminder'
        ).catch(() => undefined)
        await notify(deps, {
          profileId: m.profileId,
          event: 'billing.payment_reminder',
          vars: {
            amountDue,
            dueDateLabel: fmtDay(charge.dueDate),
            phase,
            daysOverdue,
            periodLabel,
            portalUrl: `${portalUrl}/billing`,
          },
          inApp: {
            title: phase === 'upcoming' ? 'Наближається оплата' : 'Нагадування про оплату',
            body: `${amountDue} · термін ${fmtDay(charge.dueDate)}`,
          },
          emailOverrides,
        })
      }
      remindersSent += 1

      // Фінальний крок → ескалація власникам: далі лише особистий контакт/списання.
      if (stepOffset === steps[steps.length - 1] && stepOffset > 0) {
        for (const ownerId of ownersByAgency.get(charge.agencyId) ?? []) {
          await notify(deps, {
            profileId: ownerId,
            event: 'billing.invoice_overdue',
            vars: {
              companyName: charge.company.name,
              amountDue,
              daysOverdue,
              clientUrl: `${workspaceUrl}/clients/${charge.companyId}`,
            },
            inApp: {
              title: 'Ескалація: клієнт не платить',
              body: `${charge.company.name} · ${amountDue} · ${daysOverdue} дн. прострочення`,
            },
          })
        }
        await prisma.dunningLog.update({
          where: { id: log.id },
          data: { escalatedAt: now },
        })
        escalations += 1
      }
    }

    return { markedOverdue: marked.count, remindersSent, escalations }
  })
}

const cron = makeCron({
  name: 'dunning',
  bootDelayMs: BOOT_DELAY_MS,
  intervalMs: INTERVAL_MS,
  run: async (logger) => {
    const res = await runDunningOnce(logger)
    if (res.markedOverdue > 0 || res.remindersSent > 0) {
      logger.info(res, 'dunning: run complete')
    }
  },
})
export const startDunningCron = cron.start
export const stopDunningCron = cron.stop
