import { describe, expect, it, vi } from 'vitest'
import { computeRevenueReport } from '../src/services/revenueReport.js'
import { computeMomReport } from '../src/services/momReport.js'

/**
 * 19-А/19-Д: виручка по місяцях/клієнтах (amountUsd-база) + дебіторка з віком;
 * MoM-дельти поточний/попередній місяць.
 */
const NOW = new Date('2026-07-06T12:00:00Z')

describe('computeRevenueReport (19-А)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (
    payments: unknown[],
    companies: unknown[] = [],
    debt: unknown[] = [],
    refunds: unknown[] = []
  ) =>
    ({
      payment: { findMany: vi.fn().mockResolvedValue(payments) },
      paymentRefund: { findMany: vi.fn().mockResolvedValue(refunds) },
      company: { findMany: vi.fn().mockResolvedValue(companies) },
      $queryRaw: vi.fn().mockResolvedValue(debt),
    }) as any

  const OPTS = { agencyId: 'ag-1', from: '2026-05-01', to: '2026-07-06', now: NOW }

  it('groups revenue by month and client on the amountUsd base', async () => {
    const r = await computeRevenueReport(
      db(
        [
          {
            amountUsd: 500,
            confirmedAt: new Date('2026-05-10T00:00:00Z'),
            companyId: 'co-1',
            company: { name: 'Acme' },
          },
          {
            amountUsd: 300,
            confirmedAt: new Date('2026-06-15T00:00:00Z'),
            companyId: 'co-1',
            company: { name: 'Acme' },
          },
          {
            amountUsd: 0, // bonus-backed — не роздуває виручку, але рахується оплатою
            confirmedAt: new Date('2026-06-20T00:00:00Z'),
            companyId: 'co-2',
            company: { name: 'Beta' },
          },
        ],
        [{ createdAt: new Date('2026-06-02T00:00:00Z') }]
      ),
      OPTS
    )
    expect(r.totalRevenueUsd).toBe(800)
    expect(r.totalPayments).toBe(3)
    expect(r.totalNewClients).toBe(1)
    expect(r.byMonth).toEqual([
      { month: '2026-05', revenueUsd: 500, payments: 1, newClients: 0 },
      { month: '2026-06', revenueUsd: 300, payments: 2, newClients: 1 },
    ])
    expect(r.byClient[0]).toMatchObject({ name: 'Acme', revenueUsd: 800, payments: 2 })
    expect(r.byClient[1]).toMatchObject({ name: 'Beta', revenueUsd: 0, payments: 1 })
  })

  it('HIGH-2: часткові повернення віднімаються НЕТТО (місяць/клієнт/тотал)', async () => {
    const d = db(
      [
        {
          amountUsd: 1000,
          confirmedAt: new Date('2026-05-10T00:00:00Z'),
          companyId: 'co-1',
          company: { name: 'Acme' },
        },
      ],
      [],
      [],
      [
        {
          amountUsd: 400,
          createdAt: new Date('2026-06-05T00:00:00Z'),
          payment: { companyId: 'co-1', company: { name: 'Acme' } },
        },
      ]
    )
    const r = await computeRevenueReport(d, OPTS)
    // 1000 confirmed − 400 повернення = 600 нетто; повернення падає у свій місяць (червень)
    expect(r.totalRevenueUsd).toBe(600)
    // М-1: запит рефандів фільтрує payment.status='confirmed' (повний refund → платіж
    // 'refunded' вже випав із payments; його refund-рядки = подвійний мінус, не рахуємо)
    expect(d.paymentRefund.findMany.mock.calls[0][0].where.payment).toEqual({
      is: { status: 'confirmed' },
    })
    expect(r.byMonth).toEqual([
      { month: '2026-05', revenueUsd: 1000, payments: 1, newClients: 0 },
      { month: '2026-06', revenueUsd: -400, payments: 0, newClients: 0 },
    ])
    expect(r.byClient[0]).toMatchObject({ name: 'Acme', revenueUsd: 600 })
  })

  it('merges per-currency debtor rows and computes the oldest-unpaid age', async () => {
    const r = await computeRevenueReport(
      db(
        [],
        [],
        [
          {
            companyId: 'co-1',
            name: 'Acme',
            currency: 'USD',
            debt: 1500,
            oldest: new Date('2026-06-01T12:00:00Z'), // 35 днів до NOW
          },
          {
            companyId: 'co-1',
            name: 'Acme',
            currency: 'UAH',
            debt: 8000,
            oldest: new Date('2026-07-01T12:00:00Z'), // 5 днів
          },
        ]
      ),
      OPTS
    )
    expect(r.debtors).toHaveLength(1)
    expect(r.debtors[0]).toMatchObject({
      name: 'Acme',
      debt: { USD: 1500, UAH: 8000 },
      oldestDays: 35,
    })
  })
})

describe('computeMomReport (19-Д)', () => {
  it('computes both month windows and honest deltas (prev=0 → null)', async () => {
    const paymentAggregate = vi
      .fn()
      // current, потім previous (Promise.all по сторонах — порядок викликів по side())
      .mockResolvedValueOnce({ _sum: { amountUsd: 1200 } })
      .mockResolvedValueOnce({ _sum: { amountUsd: 1000 } })
    const orderCount = vi.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(8)
    const leadCount = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(0)
    const timeAggregate = vi
      .fn()
      .mockResolvedValueOnce({ _sum: { hours: 40 } })
      .mockResolvedValueOnce({ _sum: { hours: 50 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = {
      payment: { aggregate: paymentAggregate },
      order: { count: orderCount },
      lead: { count: leadCount },
      timeLog: { aggregate: timeAggregate },
    } as any

    const r = await computeMomReport(db, { agencyId: 'ag-1', now: NOW })
    expect(r.current).toEqual({
      revenueUsd: 1200,
      ordersCreated: 6,
      leadsCreated: 3,
      hoursLogged: 40,
    })
    expect(r.previous.revenueUsd).toBe(1000)
    expect(r.pct.revenueUsd).toBe(20)
    expect(r.pct.ordersCreated).toBe(-25)
    expect(r.pct.leadsCreated).toBeNull() // prev = 0 → «—», не ∞
    expect(r.pct.hoursLogged).toBe(-20)

    // Вікна: current = [2026-07-01, 2026-08-01), previous = [2026-06-01, 2026-07-01)
    const w1 = orderCount.mock.calls[0][0].where.createdAt
    expect(w1.gte.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(w1.lt.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    const w2 = orderCount.mock.calls[1][0].where.createdAt
    expect(w2.gte.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
})
