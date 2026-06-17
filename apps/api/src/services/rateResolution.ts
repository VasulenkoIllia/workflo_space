import { Prisma } from '@workflo/db'

/**
 * Resolved client (revenue) + cost rates for a time log (PROJECTS_SPEC §2.3, P-5).
 * Snapshotted onto TimeLog at log time so margin history is stable when rates change.
 */
export interface ResolvedRates {
  clientRate: Prisma.Decimal | null // revenue / hour
  costRate: Prisma.Decimal | null // cost / hour (null = «ставку не задано» → UI warns)
  costCurrency: string | null
  costRateUsd: Prisma.Decimal | null // cost / hour in USD at the agency FX (П7)
}

/** The order fields needed to resolve rates (loaded by the caller). */
export interface OrderForRate {
  projectId: string | null
  zeroBilled: boolean
  hourlyRate: Prisma.Decimal | null // legacy per-order rate (no project)
}

/**
 * Resolve revenue + cost rates for a time log at `date` (PROJECTS_SPEC §2.3).
 *
 * Client rate (revenue): zeroBilled → 0; project → Project.clientHourlyRate (0 if
 * null — e.g. pure fixed, where revenue is the abon, hours are cost-only); legacy
 * order without a project → Order.hourlyRate.
 *
 * Cost cascade (first match wins):
 *   1. ProjectExecutorRate.zeroCost → 0
 *   2. ProjectExecutorRate.costHourlyRate (per-project override)
 *   3. ExecutorRate.zeroCostDefault → 0 (owner/partners)
 *   4. ExecutorRate.hourlyRate (person base, effective on `date`)
 *   5. else → null (UI warns; margin treats as 0)
 */
export async function resolveTimeLogRates(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; order: OrderForRate; executorId: string; date: Date }
): Promise<ResolvedRates> {
  const { agencyId, order, executorId, date } = args
  const ZERO = new Prisma.Decimal(0)

  // ── client rate (revenue) ──────────────────────────────────────────────────
  let clientRate: Prisma.Decimal | null
  if (order.zeroBilled) {
    clientRate = ZERO
  } else if (order.projectId) {
    const project = await tx.project.findUnique({
      where: { id: order.projectId },
      select: { clientHourlyRate: true },
    })
    clientRate = project?.clientHourlyRate ?? ZERO
  } else {
    clientRate = order.hourlyRate ?? ZERO
  }

  // ── cost rate (cascade §2.3) ────────────────────────────────────────────────
  let costRate: Prisma.Decimal | null = null
  let costCurrency: string | null = null

  // tiers 1-2: per-project override
  if (order.projectId) {
    const per = await tx.projectExecutorRate.findUnique({
      where: { projectId_executorId: { projectId: order.projectId, executorId } },
      select: { zeroCost: true, costHourlyRate: true, currency: true },
    })
    if (per?.zeroCost) {
      costRate = ZERO
      costCurrency = per.currency
    } else if (per?.costHourlyRate != null) {
      costRate = per.costHourlyRate
      costCurrency = per.currency
    }
  }

  // tiers 3-4: person base rate effective on `date`
  if (costRate === null) {
    const rate = await tx.executorRate.findFirst({
      where: {
        executorId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { zeroCostDefault: true, hourlyRate: true, currency: true },
    })
    if (rate?.zeroCostDefault) {
      costRate = ZERO
      costCurrency = rate.currency
    } else if (rate?.hourlyRate != null) {
      costRate = rate.hourlyRate
      costCurrency = rate.currency
    }
  }
  // tier 5: costRate stays null → caller/UI surfaces «ставку не задано».

  // ── costRateUsd (П7): convert at the agency FX ──────────────────────────────
  let costRateUsd: Prisma.Decimal | null = null
  if (costRate !== null) {
    if (costCurrency === 'USD' || costCurrency === null) {
      costRateUsd = costRate
    } else {
      const fx = await tx.exchangeRate.findUnique({
        where: { agencyId },
        select: { usdToUah: true, eurToUah: true },
      })
      if (costCurrency === 'UAH' && fx?.usdToUah && !fx.usdToUah.isZero()) {
        costRateUsd = costRate.div(fx.usdToUah).toDecimalPlaces(2)
      } else if (costCurrency === 'EUR' && fx?.eurToUah && fx?.usdToUah && !fx.usdToUah.isZero()) {
        costRateUsd = costRate.times(fx.eurToUah).div(fx.usdToUah).toDecimalPlaces(2) // EUR→UAH→USD
      } else {
        costRateUsd = null // unknown FX — margin engine (P-9) handles the gap
      }
    }
  }

  return { clientRate, costRate, costCurrency, costRateUsd }
}
