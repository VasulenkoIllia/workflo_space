import { Prisma, withTenant } from '@workflo/db'
import { type FxRates, toUsd } from './currency.js'

/**
 * Profit & Loss (S5-10, module 22). `netProfit = revenue − expenses` over a date
 * window, everything normalized to USD.
 *
 *  - revenue = Σ Payment.amountUsd (confirmed) − Σ PaymentRefund.amountUsd, both in the
 *    window (НЕТТО: часткові повернення лишають Payment 'confirmed', тож віднімаємо їх окремо;
 *    HIGH-2, аудит 08.07). Bonus-backed payments carry amountUsd=0, so they never inflate revenue.
 *  - expenses = operator expenses + salary. Recurring expenses are normalized to a
 *    monthly run-rate (monthly=×1, quarterly÷3, annual÷12) and counted for each month
 *    of the window they are active; one-time expenses land fully in their start month.
 *  - SALARY is pulled from ExecutorRate (`monthlySalary`) for active windows — the
 *    SINGLE salary source. Manual `category=salary` expenses are EXCLUDED from the sum
 *    so an executor's pay is never double-counted; ExecutorPayout (settlement) is also
 *    never added (ExecutorRate is the cost basis).
 *  - non-USD amounts are converted with the agency's stored ExchangeRate.
 */

interface YearMonth {
  y: number
  m: number // 0-based
}

function monthsInRange(from: Date, to: Date): YearMonth[] {
  const out: YearMonth[] = []
  let y = from.getUTCFullYear()
  let m = from.getUTCMonth()
  const endY = to.getUTCFullYear()
  const endM = to.getUTCMonth()
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ y, m })
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }
  return out
}

function monthStart(ym: YearMonth): Date {
  return new Date(Date.UTC(ym.y, ym.m, 1))
}
function monthEnd(ym: YearMonth): Date {
  return new Date(Date.UTC(ym.y, ym.m + 1, 1) - 1)
}

/** An [start, end] window is active in a month if it overlaps [monthStart, monthEnd]. */
function activeIn(start: Date, end: Date | null, ym: YearMonth): boolean {
  return (
    start.getTime() <= monthEnd(ym).getTime() &&
    (end == null || end.getTime() >= monthStart(ym).getTime())
  )
}

function monthlyRunRate(amount: Prisma.Decimal, frequency: string | null): Prisma.Decimal {
  if (frequency === 'quarterly') return amount.div(3)
  if (frequency === 'annual') return amount.div(12)
  return amount // monthly (or unspecified)
}

export interface PnlLine {
  category: string
  amountUsd: string
}

export interface Pnl {
  from: string
  to: string
  revenueUsd: string
  expensesUsd: string
  salaryUsd: string
  laborHourlyUsd: string
  netProfitUsd: string
  marginPct: string
  byCategory: PnlLine[]
}

export async function computePnl(args: {
  agencyId: string
  from: string
  to: string
}): Promise<Pnl> {
  const from = new Date(`${args.from}T00:00:00.000Z`)
  const to = new Date(`${args.to}T23:59:59.999Z`)
  const months = monthsInRange(from, to)

  const data = await withTenant(async (tx) => {
    const [revenueAgg, refundAgg, expenses, rates, rate, laborRows] = await Promise.all([
      tx.payment.aggregate({
        where: {
          agencyId: args.agencyId,
          status: 'confirmed',
          confirmedAt: { gte: from, lte: to },
        },
        _sum: { amountUsd: true },
      }),
      // HIGH-2 (аудит 08.07): часткові повернення лишають Payment 'confirmed' з повною сумою —
      // тож виручку треба брати НЕТТО (мінус PaymentRefund у вікні), інакше маржа завищена.
      tx.paymentRefund.aggregate({
        where: { agencyId: args.agencyId, createdAt: { gte: from, lte: to } },
        _sum: { amountUsd: true },
      }),
      tx.expense.findMany({
        where: { agencyId: args.agencyId, isActive: true },
        select: {
          type: true,
          category: true,
          amount: true,
          currency: true,
          frequency: true,
          startDate: true,
          endDate: true,
        },
      }),
      tx.executorRate.findMany({
        where: { agencyId: args.agencyId, monthlySalary: { not: null } },
        select: {
          executorId: true,
          monthlySalary: true,
          currency: true,
          effectiveFrom: true,
          effectiveUntil: true,
        },
      }),
      tx.exchangeRate.findUnique({
        where: { agencyId: args.agencyId },
        select: { usdToUah: true, eurToUah: true },
      }),
      // ХВІСТ-3: собівартість погодинної праці — Σ(hours × costRateUsd) по виконавцях за період.
      // Тільки для несалярних (salaried час покритий окладом) — фільтр нижче.
      tx.$queryRaw<Array<{ executorId: string; cost: string | null }>>`
        SELECT t."executorId" AS "executorId",
               COALESCE(SUM(t."hours" * COALESCE(t."costRateUsd", 0)), 0) AS cost
        FROM "time_logs" t
        WHERE t."agencyId" = ${args.agencyId}
          AND t."date" >= ${from}
          AND t."date" <= ${to}
        GROUP BY t."executorId"
      `,
    ])
    return { revenueAgg, refundAgg, expenses, rates, rate, laborRows }
  })

  const rates: FxRates = {
    usdToUah: data.rate?.usdToUah ?? null,
    eurToUah: data.rate?.eurToUah ?? null,
  }
  const refundsUsd = data.refundAgg._sum.amountUsd ?? new Prisma.Decimal(0)
  const revenueUsd = (data.revenueAgg._sum.amountUsd ?? new Prisma.Decimal(0)).minus(refundsUsd)

  const byCategory = new Map<string, Prisma.Decimal>()
  const add = (category: string, amount: Prisma.Decimal) => {
    byCategory.set(category, (byCategory.get(category) ?? new Prisma.Decimal(0)).plus(amount))
  }

  for (const e of data.expenses) {
    // Manual salary lines are excluded — ExecutorRate is the single salary source.
    if (e.category === 'salary') continue
    const amount = new Prisma.Decimal(e.amount)
    if (e.type === 'one_time') {
      if (e.startDate.getTime() >= from.getTime() && e.startDate.getTime() <= to.getTime()) {
        add(e.category, toUsd(amount, e.currency, rates))
      }
      continue
    }
    const monthly = toUsd(monthlyRunRate(amount, e.frequency), e.currency, rates)
    for (const ym of months) {
      if (activeIn(e.startDate, e.endDate, ym)) add(e.category, monthly)
    }
  }

  // Salary from ExecutorRate — counted once per active month.
  let salaryUsd = new Prisma.Decimal(0)
  for (const r of data.rates) {
    if (!r.monthlySalary) continue
    const monthly = toUsd(new Prisma.Decimal(r.monthlySalary), r.currency, rates)
    for (const ym of months) {
      if (activeIn(r.effectiveFrom, r.effectiveUntil, ym)) salaryUsd = salaryUsd.plus(monthly)
    }
  }
  if (salaryUsd.greaterThan(0)) add('salary', salaryUsd)

  // ХВІСТ-3: собівартість погодинної праці. Виконавці з активним окладом у періоді
  // вже враховані через salary → їхній час НЕ додаємо (без подвійного рахунку). Решта
  // (погодинники/контрактори) → Σ(hours × costRateUsd) стає окремою статтею витрат.
  // KNOWN-LIMITATION (MED-4, аудит 08.07): виключення — по ВСЬОМУ вікну, не помісячно. Якщо
  // виконавець салярний лише частину багатомісячного вікна (потім перейшов на погодинну), його
  // погодинні години теж викидаються → собівартість трохи занижена на межі зміни ставки.
  // Рідкісний край; точний фікс — помісячна сегментація salariedIds (окремий зріз).
  const salariedIds = new Set<string>()
  for (const r of data.rates) {
    if (!r.monthlySalary) continue
    if (months.some((ym) => activeIn(r.effectiveFrom, r.effectiveUntil, ym))) {
      salariedIds.add(r.executorId)
    }
  }
  let laborHourlyUsd = new Prisma.Decimal(0)
  for (const row of data.laborRows) {
    if (salariedIds.has(row.executorId)) continue
    laborHourlyUsd = laborHourlyUsd.plus(new Prisma.Decimal(row.cost ?? 0))
  }
  laborHourlyUsd = laborHourlyUsd.toDecimalPlaces(2)
  if (laborHourlyUsd.greaterThan(0)) add('labor_hourly', laborHourlyUsd)

  let expensesUsd = new Prisma.Decimal(0)
  for (const v of byCategory.values()) expensesUsd = expensesUsd.plus(v)

  const netProfit = revenueUsd.minus(expensesUsd)
  const marginPct = revenueUsd.greaterThan(0)
    ? netProfit.div(revenueUsd).times(100).toDecimalPlaces(2)
    : new Prisma.Decimal(0)

  return {
    from: args.from,
    to: args.to,
    revenueUsd: revenueUsd.toFixed(2),
    expensesUsd: expensesUsd.toFixed(2),
    salaryUsd: salaryUsd.toFixed(2),
    laborHourlyUsd: laborHourlyUsd.toFixed(2),
    netProfitUsd: netProfit.toFixed(2),
    marginPct: marginPct.toFixed(2),
    byCategory: [...byCategory.entries()].map(([category, amountUsd]) => ({
      category,
      amountUsd: amountUsd.toFixed(2),
    })),
  }
}

/** Render a P&L as a flat CSV (header + category lines + summary rows). */
export function pnlToCsv(pnl: Pnl): string {
  const rows: string[] = ['category,amountUsd']
  for (const line of pnl.byCategory) rows.push(`${line.category},${line.amountUsd}`)
  rows.push(`revenue,${pnl.revenueUsd}`)
  rows.push(`expenses_total,${pnl.expensesUsd}`)
  rows.push(`net_profit,${pnl.netProfitUsd}`)
  rows.push(`margin_pct,${pnl.marginPct}`)
  return rows.join('\n')
}
