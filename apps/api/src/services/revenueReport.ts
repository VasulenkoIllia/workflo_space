import { Prisma } from '@workflo/db'

/**
 * 19-А: звіт «Виручка» — по місяцях і по клієнтах + нові клієнти + дебіторка з віком.
 * База виручки = Payment.amountUsd (confirmed) − PaymentRefund.amountUsd — НЕТТО, консистентно
 * з P&L (bonus-backed платежі несуть amountUsd=0 і виручку не роздувають; часткові повернення
 * лишають Payment 'confirmed', тож віднімаються окремо — HIGH-2, аудит 08.07). Дебіторка —
 * Σ(totalAmount − confirmed + refunded) по неоплачених, per-currency + вік найстарішого.
 */

export interface RevenueMonthRow {
  /** 'YYYY-MM' (UTC). */
  month: string
  revenueUsd: number
  payments: number
  newClients: number
}

export interface RevenueClientRow {
  companyId: string
  name: string
  revenueUsd: number
  payments: number
}

export interface DebtorRow {
  companyId: string
  name: string
  /** Борг per-currency: «1500 USD · 8000 UAH». */
  debt: Record<string, number>
  /** Вік найстарішого неоплаченого замовлення, днів. */
  oldestDays: number
}

export interface RevenueReport {
  from: string
  to: string
  totalRevenueUsd: number
  totalPayments: number
  totalNewClients: number
  byMonth: RevenueMonthRow[]
  byClient: RevenueClientRow[]
  debtors: DebtorRow[]
}

type Db = Pick<Prisma.TransactionClient, 'payment' | 'paymentRefund' | 'company' | '$queryRaw'>

const round2 = (n: number): number => Math.round(n * 100) / 100
const monthKey = (d: Date): string => d.toISOString().slice(0, 7)

export async function computeRevenueReport(
  db: Db,
  opts: { agencyId: string; from: string; to: string; now?: Date }
): Promise<RevenueReport> {
  const now = opts.now ?? new Date()
  const windowEnd = new Date(new Date(opts.to).getTime() + 86_400_000) // inclusive `to`
  const window = { gte: new Date(opts.from), lt: windowEnd }

  const [payments, refunds, newCompanies, debtRows] = await Promise.all([
    db.payment.findMany({
      where: { agencyId: opts.agencyId, status: 'confirmed', confirmedAt: window },
      select: {
        amountUsd: true,
        confirmedAt: true,
        companyId: true,
        company: { select: { name: true } },
      },
      take: 5000,
    }),
    // HIGH-2 (аудит 08.07): часткові повернення лишають Payment 'confirmed' з повною сумою —
    // тож виручка (місяць/клієнт/тотал) НЕТТО: мінус PaymentRefund у вікні (за датою повернення).
    db.paymentRefund.findMany({
      where: { agencyId: opts.agencyId, createdAt: window },
      select: {
        amountUsd: true,
        createdAt: true,
        payment: { select: { companyId: true, company: { select: { name: true } } } },
      },
      take: 5000,
    }),
    db.company.findMany({
      where: { agencyId: opts.agencyId, createdAt: window },
      select: { createdAt: true },
      take: 1000,
    }),
    // Дебіторка per-currency + вік найстарішого неоплаченого замовлення (поточний стан).
    // Нетто-оплата = confirmed − refunds, тож борг = total − paid + refunded (HIGH-2).
    db.$queryRaw<
      { companyId: string; name: string; currency: string; debt: unknown; oldest: Date }[]
    >(Prisma.sql`
      SELECT o."companyId" AS "companyId", c."name" AS name, o."currency" AS currency,
             SUM(o."totalAmount" - COALESCE(p.paid, 0) + COALESCE(pr.refunded, 0)) AS debt,
             MIN(o."createdAt") AS oldest
      FROM "orders" o
      JOIN "companies" c ON c."id" = o."companyId"
      LEFT JOIN (
        SELECT "orderId", SUM("amount") AS paid
        FROM "payments" WHERE "status" = 'confirmed'
        GROUP BY "orderId"
      ) p ON p."orderId" = o."id"
      LEFT JOIN (
        SELECT pay."orderId", SUM(r."amount") AS refunded
        FROM "payment_refunds" r
        JOIN "payments" pay ON pay."id" = r."paymentId"
        WHERE pay."status" = 'confirmed'
        GROUP BY pay."orderId"
      ) pr ON pr."orderId" = o."id"
      WHERE o."agencyId" = ${opts.agencyId}
        AND o."paidAt" IS NULL
        AND o."totalAmount" IS NOT NULL
        AND o."deletedAt" IS NULL
        AND o."companyId" IS NOT NULL
      GROUP BY o."companyId", c."name", o."currency"
      HAVING SUM(o."totalAmount" - COALESCE(p.paid, 0) + COALESCE(pr.refunded, 0)) > 0
    `),
  ])

  // По місяцях
  const months = new Map<string, RevenueMonthRow>()
  const ensureMonth = (key: string): RevenueMonthRow => {
    let m = months.get(key)
    if (!m) {
      m = { month: key, revenueUsd: 0, payments: 0, newClients: 0 }
      months.set(key, m)
    }
    return m
  }
  // По клієнтах
  const clients = new Map<string, RevenueClientRow>()

  let totalRevenueUsd = 0
  for (const p of payments) {
    const usd = Number(p.amountUsd ?? 0)
    totalRevenueUsd += usd
    if (p.confirmedAt) {
      const m = ensureMonth(monthKey(p.confirmedAt))
      m.revenueUsd = round2(m.revenueUsd + usd)
      m.payments += 1
    }
    const c = clients.get(p.companyId) ?? {
      companyId: p.companyId,
      name: p.company?.name ?? '—',
      revenueUsd: 0,
      payments: 0,
    }
    c.revenueUsd = round2(c.revenueUsd + usd)
    c.payments += 1
    clients.set(p.companyId, c)
  }
  // HIGH-2: віднімаємо повернення НЕТТО (місяць за датою повернення, клієнт за платежем, тотал).
  for (const r of refunds) {
    const usd = Number(r.amountUsd ?? 0)
    if (usd === 0) continue
    totalRevenueUsd -= usd
    const m = ensureMonth(monthKey(r.createdAt))
    m.revenueUsd = round2(m.revenueUsd - usd)
    const cid = r.payment.companyId
    if (cid) {
      const c = clients.get(cid) ?? {
        companyId: cid,
        name: r.payment.company?.name ?? '—',
        revenueUsd: 0,
        payments: 0,
      }
      c.revenueUsd = round2(c.revenueUsd - usd)
      clients.set(cid, c)
    }
  }
  for (const co of newCompanies) {
    ensureMonth(monthKey(co.createdAt)).newClients += 1
  }

  // Дебіторка: злити per-currency рядки по компанії
  const debtors = new Map<string, DebtorRow>()
  for (const r of debtRows) {
    const d = debtors.get(r.companyId) ?? {
      companyId: r.companyId,
      name: r.name,
      debt: {},
      oldestDays: 0,
    }
    d.debt[r.currency] = round2(Number(r.debt))
    d.oldestDays = Math.max(
      d.oldestDays,
      Math.floor((now.getTime() - r.oldest.getTime()) / 86_400_000)
    )
    debtors.set(r.companyId, d)
  }

  return {
    from: opts.from,
    to: opts.to,
    totalRevenueUsd: round2(totalRevenueUsd),
    totalPayments: payments.length,
    totalNewClients: newCompanies.length,
    byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    byClient: [...clients.values()].sort((a, b) => b.revenueUsd - a.revenueUsd),
    debtors: [...debtors.values()].sort((a, b) => b.oldestDays - a.oldestDays),
  }
}
