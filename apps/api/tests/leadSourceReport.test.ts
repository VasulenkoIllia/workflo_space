import { describe, expect, it, vi } from 'vitest'
import { computeLeadSourceReport } from '../src/services/leadSourceReport.js'

/**
 * Pure-service тест аналітики джерел лідів (S11): групування utm→manual→'(без джерела)',
 * конверсія, per-currency гроші зі сконвертованих замовлень, топ-кампанії.
 */
interface FakeLead {
  id: string
  status: string
  source: string | null
  utmSource: string | null
  utmCampaign: string | null
  convertedOrderId: string | null
}

const lead = (over: Partial<FakeLead>): FakeLead => ({
  id: Math.random().toString(36).slice(2),
  status: 'new',
  source: null,
  utmSource: null,
  utmCampaign: null,
  convertedOrderId: null,
  ...over,
})

function makeDb(leads: FakeLead[], orders: unknown[] = []) {
  return {
    lead: { findMany: vi.fn().mockResolvedValue(leads) },
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const OPTS = { agencyId: 'ag-1', from: '2026-07-01', to: '2026-07-05' }

describe('computeLeadSourceReport', () => {
  it('groups by utmSource → manual source → «(без джерела)» with kinds', async () => {
    const db = makeDb([
      lead({ utmSource: 'google', source: 'website' }), // utm виграє над manual
      lead({ utmSource: 'google' }),
      lead({ source: 'referral' }),
      lead({}),
    ])
    const r = await computeLeadSourceReport(db, OPTS)
    expect(r.totalLeads).toBe(4)
    expect(r.rows.map((x) => [x.source, x.kind, x.leads])).toEqual([
      ['google', 'utm', 2],
      ['referral', 'manual', 1],
      ['(без джерела)', 'none', 1],
    ])
  })

  it('computes conversion and per-currency revenue from converted orders', async () => {
    const db = makeDb(
      [
        lead({ utmSource: 'google', status: 'won', convertedOrderId: 'ord-1' }),
        lead({ utmSource: 'google', status: 'won', convertedOrderId: 'ord-2' }),
        lead({ utmSource: 'google', status: 'lost' }),
        lead({ utmSource: 'google' }),
      ],
      [
        { id: 'ord-1', totalAmount: 500, fixedPrice: null, currency: 'USD', paidAt: new Date() },
        { id: 'ord-2', totalAmount: null, fixedPrice: 8000, currency: 'UAH', paidAt: null },
      ]
    )
    const r = await computeLeadSourceReport(db, OPTS)
    const g = r.rows[0]
    expect(g.won).toBe(2)
    expect(g.lost).toBe(1)
    expect(g.converted).toBe(2)
    expect(g.conversionPct).toBe(50)
    // валюти не зшиваються
    expect(g.revenue).toEqual({ USD: 500, UAH: 8000 })
    // оплачені — лише ord-1
    expect(g.paidRevenue).toEqual({ USD: 500 })
  })

  it('collects top campaigns only for leads with both utmSource and utmCampaign', async () => {
    const db = makeDb([
      lead({ utmSource: 'google', utmCampaign: 'spring', status: 'won' }),
      lead({ utmSource: 'google', utmCampaign: 'spring' }),
      lead({ utmSource: 'google' }), // без кампанії — не в campaigns
      lead({ source: 'referral', utmCampaign: 'ghost' }), // без utmSource — не в campaigns
    ])
    const r = await computeLeadSourceReport(db, OPTS)
    expect(r.campaigns).toEqual([{ source: 'google', campaign: 'spring', leads: 2, won: 1 }])
  })

  it('skips the orders query entirely when nothing converted', async () => {
    const db = makeDb([lead({}), lead({ utmSource: 'fb' })])
    const r = await computeLeadSourceReport(db, OPTS)
    expect(r.rows.reduce((s, x) => s + x.converted, 0)).toBe(0)
    expect(db.order.findMany).not.toHaveBeenCalled()
  })
})
