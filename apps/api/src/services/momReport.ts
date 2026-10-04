import { type Prisma } from '@workflo/db'

/**
 * 19-Д: ±% MoM — поточний місяць проти попереднього (UTC-місяці) для дельта-чіпів
 * owner-дашборда. Виручка = Payment.amountUsd (та сама база, що P&L/overview);
 * решта — прості лічильники вікна. % = (cur − prev) / prev × 100; prev = 0 → null
 * (чесніше «—», ніж ∞).
 */

export interface MomSide {
  revenueUsd: number
  ordersCreated: number
  leadsCreated: number
  hoursLogged: number
}

export interface MomReport {
  current: MomSide
  previous: MomSide
  pct: { [K in keyof MomSide]: number | null }
}

type Db = Pick<Prisma.TransactionClient, 'payment' | 'order' | 'lead' | 'timeLog'>

const round2 = (n: number): number => Math.round(n * 100) / 100

async function side(db: Db, agencyId: string, from: Date, to: Date): Promise<MomSide> {
  const window = { gte: from, lt: to }
  const [rev, orders, leads, hours] = await Promise.all([
    db.payment.aggregate({
      where: { agencyId, status: 'confirmed', confirmedAt: window },
      _sum: { amountUsd: true },
    }),
    db.order.count({ where: { agencyId, deletedAt: null, createdAt: window } }),
    db.lead.count({ where: { agencyId, createdAt: window } }),
    db.timeLog.aggregate({ where: { agencyId, date: window }, _sum: { hours: true } }),
  ])
  return {
    revenueUsd: round2(Number(rev._sum.amountUsd ?? 0)),
    ordersCreated: orders,
    leadsCreated: leads,
    hoursLogged: round2(Number(hours._sum.hours ?? 0)),
  }
}

const delta = (cur: number, prev: number): number | null =>
  prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10

export async function computeMomReport(
  db: Db,
  opts: { agencyId: string; now?: Date }
): Promise<MomReport> {
  const now = opts.now ?? new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const nextStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const [current, previous] = await Promise.all([
    side(db, opts.agencyId, monthStart, nextStart),
    side(db, opts.agencyId, prevStart, monthStart),
  ])
  return {
    current,
    previous,
    pct: {
      revenueUsd: delta(current.revenueUsd, previous.revenueUsd),
      ordersCreated: delta(current.ordersCreated, previous.ordersCreated),
      leadsCreated: delta(current.leadsCreated, previous.leadsCreated),
      hoursLogged: delta(current.hoursLogged, previous.hoursLogged),
    },
  }
}
