import { Prisma } from '@workflo/db'

/**
 * 19-Г: збірка даних місячного звіту клієнту для однієї компанії за вікно
 * [from, to) (UTC-місяць). Що зроблено (нові + завершені замовлення), години по
 * проєктах, оплати за період і поточний борг. Гроші per-currency (без зшивання).
 *
 * «Завершено» — з ActivityLog (status_changed → done у вікні): у Order нема doneAt,
 * той самий підхід, що в SLA-звіті. Борг — та сама формула, що в billing/overview
 * (Σ totalAmount − confirmed payments по неоплачених замовленнях), але per-currency.
 */

export interface ClientMonthlyNumbers {
  newOrders: { title: string; amount: string | null }[]
  completedOrders: { title: string }[]
  hoursByProject: { project: string; hours: number }[]
  totalHours: number
  paid: Record<string, number>
  debt: Record<string, number>
  /** Хоч щось за місяць було (порожнім компаніям звіт не шлемо). */
  hasActivity: boolean
}

type Db = Pick<
  Prisma.TransactionClient,
  'order' | 'activityLog' | 'timeLog' | 'payment' | '$queryRaw'
>

const round2 = (n: number): number => Math.round(n * 100) / 100

export function moneyLabel(bag: Record<string, number>): string {
  const parts = Object.entries(bag).map(([cur, amt]) => `${amt} ${cur}`)
  return parts.length > 0 ? parts.join(' · ') : '0'
}

export async function computeClientMonthlyNumbers(
  db: Db,
  opts: { agencyId: string; companyId: string; from: Date; to: Date }
): Promise<ClientMonthlyNumbers> {
  const { agencyId, companyId, from, to } = opts
  const window = { gte: from, lt: to }

  const [newOrders, doneActs, timeLogs, payments, debtRows] = await Promise.all([
    db.order.findMany({
      where: { agencyId, companyId, deletedAt: null, createdAt: window },
      select: { title: true, totalAmount: true, fixedPrice: true, currency: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
    db.activityLog.findMany({
      where: {
        agencyId,
        action: 'status_changed',
        createdAt: window,
        order: { companyId, deletedAt: null },
      },
      select: { orderId: true, metadata: true, order: { select: { title: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    db.timeLog.findMany({
      where: { agencyId, date: window, order: { companyId, deletedAt: null } },
      select: { hours: true, order: { select: { project: { select: { name: true } } } } },
      take: 2000,
    }),
    db.payment.findMany({
      where: { agencyId, companyId, status: 'confirmed', confirmedAt: window },
      select: { amount: true, currency: true },
      take: 500,
    }),
    // Поточний борг per-currency (формула billing/overview, скоуп — компанія)
    db.$queryRaw<{ currency: string; debt: unknown }[]>(Prisma.sql`
      SELECT o."currency" AS currency,
             SUM(o."totalAmount" - COALESCE(p.paid, 0)) AS debt
      FROM "orders" o
      LEFT JOIN (
        SELECT "orderId", SUM("amount") AS paid
        FROM "payments" WHERE "status" = 'confirmed'
        GROUP BY "orderId"
      ) p ON p."orderId" = o."id"
      WHERE o."agencyId" = ${agencyId}
        AND o."companyId" = ${companyId}
        AND o."paidAt" IS NULL
        AND o."totalAmount" IS NOT NULL
        AND o."deletedAt" IS NULL
      GROUP BY o."currency"
      HAVING SUM(o."totalAmount" - COALESCE(p.paid, 0)) > 0
    `),
  ])

  // Завершені: перший status_changed → done на замовлення у вікні
  const doneSeen = new Set<string>()
  const completedOrders: { title: string }[] = []
  for (const a of doneActs) {
    const to_ = (a.metadata as { to?: string } | null)?.to
    if (to_ === 'done' && !doneSeen.has(a.orderId)) {
      doneSeen.add(a.orderId)
      completedOrders.push({ title: a.order.title })
    }
  }

  // Години по проєктах
  const byProject = new Map<string, number>()
  let totalHours = 0
  for (const t of timeLogs) {
    const hours = Number(t.hours)
    totalHours += hours
    const key = t.order?.project?.name ?? '(без проєкту)'
    byProject.set(key, round2((byProject.get(key) ?? 0) + hours))
  }

  const paid: Record<string, number> = {}
  for (const p of payments) {
    paid[p.currency] = round2((paid[p.currency] ?? 0) + Number(p.amount))
  }
  const debt: Record<string, number> = {}
  for (const d of debtRows) {
    debt[d.currency] = round2(Number(d.debt))
  }

  return {
    newOrders: newOrders.map((o) => {
      const amount = o.totalAmount ?? o.fixedPrice
      return {
        title: o.title,
        amount: amount != null ? `${Number(amount)} ${o.currency}` : null,
      }
    }),
    completedOrders,
    hoursByProject: [...byProject.entries()]
      .map(([project, hours]) => ({ project, hours }))
      .sort((a, b) => b.hours - a.hours),
    totalHours: round2(totalHours),
    paid,
    debt,
    hasActivity:
      newOrders.length > 0 || completedOrders.length > 0 || totalHours > 0 || payments.length > 0,
  }
}
