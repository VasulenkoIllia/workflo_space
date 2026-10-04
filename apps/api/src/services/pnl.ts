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
 *  - INCOME TAX (S13-06, рішення власника 18.06): податок = % від ОТРИМАНОГО доходу
 *    per-юр-особа/канал (ФОП 5% / крипта 0%) — НЕ класичний ПДВ. Лінія `income_tax` =
 *    Σ по юр-особах ((confirmed amountUsd − refunds confirmed-платежів) × incomeTaxPct).
 *    Period-семантика як у комісії-клавбеку: refund зменшує базу ПОТОЧНОГО вікна (може
 *    дати відʼємний податок-кредит). Платежі без legalEntityId (легасі) і bonus-платежі
 *    (amountUsd=0) не оподатковуються.
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
  incomeTaxUsd: string // S13-06: податок з доходу per-юр-особа (входить і в byCategory/expenses)
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
    const [
      revenueAgg,
      refundAgg,
      expenses,
      rates,
      rate,
      laborRows,
      taxRows,
      taxRefunds,
      taxedEntities,
    ] = await Promise.all([
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
      // Рахуємо ЛИШЕ refund-и confirmed-платежів (мета-аудит М-1): повний refund флипає платіж
      // у 'refunded' → він уже випав з revenueAgg, і його refund-рядки віднімати НЕ можна
      // (було б подвійне віднімання). Той самий патерн, що refund-JOIN у recomputeMoneyBalance.
      tx.paymentRefund.aggregate({
        where: {
          agencyId: args.agencyId,
          createdAt: { gte: from, lte: to },
          payment: { is: { status: 'confirmed' } },
        },
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
      // ХВІСТ-3: собівартість погодинної праці — Σ(hours × costRateUsd) ПОМІСЯЧНО по виконавцях
      // (MED-4: групуємо по місяцю, щоб виключати оклад-покриті години лише за ті місяці, де
      // виконавець фактично салярний — а не викидати його по всьому вікну).
      tx.$queryRaw<Array<{ executorId: string; ym: string; cost: string | null }>>`
        SELECT t."executorId" AS "executorId",
               to_char(date_trunc('month', t."date"), 'YYYY-MM') AS ym,
               COALESCE(SUM(t."hours" * COALESCE(t."costRateUsd", 0)), 0) AS cost
        FROM "time_logs" t
        WHERE t."agencyId" = ${args.agencyId}
          AND t."date" >= ${from}
          AND t."date" <= ${to}
        GROUP BY t."executorId", date_trunc('month', t."date")
      `,
      // S13-06: податкова база — confirmed-платежі вікна, згруповані по юр-особі.
      tx.payment.groupBy({
        by: ['legalEntityId'],
        where: {
          agencyId: args.agencyId,
          status: 'confirmed',
          legalEntityId: { not: null },
          confirmedAt: { gte: from, lte: to },
        },
        _sum: { amountUsd: true },
      }),
      // Refund-клавбек бази (той самий М-1 фільтр: лише refund-и confirmed-платежів).
      tx.paymentRefund.findMany({
        where: {
          agencyId: args.agencyId,
          createdAt: { gte: from, lte: to },
          payment: { is: { status: 'confirmed', legalEntityId: { not: null } } },
        },
        select: { amountUsd: true, payment: { select: { legalEntityId: true } } },
      }),
      tx.legalEntity.findMany({
        where: { agencyId: args.agencyId, incomeTaxPct: { gt: 0 } },
        select: { id: true, incomeTaxPct: true },
      }),
    ])
    return {
      revenueAgg,
      refundAgg,
      expenses,
      rates,
      rate,
      laborRows,
      taxRows,
      taxRefunds,
      taxedEntities,
    }
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

  // ХВІСТ-3: собівартість погодинної праці. Години місяців, де виконавець мав активний
  // оклад, уже покриті статтею salary → їх НЕ додаємо (без подвійного рахунку). Решта
  // (погодинні місяці / контрактори) → Σ(hours × costRateUsd) — окрема стаття витрат.
  // MED-4 (закрито 10.07): виключення ПОМІСЯЧНЕ — виконавець «салярний у січні, погодинний
  // у лютому» дає лютневу собівартість у витрати (раніше викидався по всьому вікну).
  const salariedInMonth = (executorId: string, ym: YearMonth): boolean =>
    data.rates.some(
      (r) =>
        r.executorId === executorId &&
        r.monthlySalary != null &&
        activeIn(r.effectiveFrom, r.effectiveUntil, ym)
    )
  let laborHourlyUsd = new Prisma.Decimal(0)
  for (const row of data.laborRows) {
    const [yStr, mStr] = row.ym.split('-')
    const ym: YearMonth = { y: Number(yStr), m: Number(mStr) - 1 }
    if (salariedInMonth(row.executorId, ym)) continue
    laborHourlyUsd = laborHourlyUsd.plus(new Prisma.Decimal(row.cost ?? 0))
  }
  laborHourlyUsd = laborHourlyUsd.toDecimalPlaces(2)
  if (laborHourlyUsd.greaterThan(0)) add('labor_hourly', laborHourlyUsd)

  // S13-06: податок з доходу — по кожній оподаткованій юр-особі:
  // (confirmed-платежі вікна − refund-клавбек) × ставка. Період-семантика: refund
  // зменшує базу поточного вікна; відʼємна база → податок-кредит (без clamp).
  const taxRate = new Map(data.taxedEntities.map((e) => [e.id, new Prisma.Decimal(e.incomeTaxPct)]))
  const taxBase = new Map<string, Prisma.Decimal>()
  for (const row of data.taxRows) {
    if (!row.legalEntityId || !taxRate.has(row.legalEntityId)) continue
    taxBase.set(row.legalEntityId, new Prisma.Decimal(row._sum.amountUsd ?? 0))
  }
  for (const r of data.taxRefunds) {
    const leId = r.payment.legalEntityId
    if (!leId || !taxRate.has(leId)) continue
    taxBase.set(leId, (taxBase.get(leId) ?? new Prisma.Decimal(0)).minus(r.amountUsd ?? 0))
  }
  let incomeTaxUsd = new Prisma.Decimal(0)
  for (const [leId, base] of taxBase) {
    const pct = taxRate.get(leId)
    if (!pct) continue
    incomeTaxUsd = incomeTaxUsd.plus(base.times(pct).div(100))
  }
  incomeTaxUsd = incomeTaxUsd.toDecimalPlaces(2)
  if (!incomeTaxUsd.isZero()) add('income_tax', incomeTaxUsd)

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
    incomeTaxUsd: incomeTaxUsd.toFixed(2),
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
