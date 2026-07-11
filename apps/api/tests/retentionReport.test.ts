import { describe, expect, it, vi } from 'vitest'
import { computeRetentionReport } from '../src/services/retentionReport.js'

// S11-07: retention-математика на детермінованих фікстурах (now зафіксований).
const NOW = new Date('2026-07-11T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

function makeDb(opts: {
  companies?: Array<{
    id: string
    name: string
    loyaltyTier?: string
    totalSpent?: number
    createdAt: Date
  }>
  orders?: Array<{ companyId: string; createdAt: Date }>
  payments?: Array<{ companyId: string; confirmedAt: Date }>
}) {
  return {
    company: {
      findMany: vi.fn().mockResolvedValue(
        (opts.companies ?? []).map((c) => ({
          loyaltyTier: 'new',
          totalSpent: 0,
          ...c,
        }))
      ),
    },
    order: { findMany: vi.fn().mockResolvedValue(opts.orders ?? []) },
    payment: { findMany: vi.fn().mockResolvedValue(opts.payments ?? []) },
  } as never
}

describe('computeRetentionReport (S11-07)', () => {
  it('repeat rate + медіана днів до 2-го замовлення (непарна і парна кількість)', async () => {
    const db = makeDb({
      companies: [
        { id: 'a', name: 'A', createdAt: daysAgo(200) },
        { id: 'b', name: 'B', createdAt: daysAgo(200) },
        { id: 'c', name: 'C', createdAt: daysAgo(200) },
      ],
      orders: [
        // A: 1-е і 2-е з різницею 10 днів
        { companyId: 'a', createdAt: daysAgo(100) },
        { companyId: 'a', createdAt: daysAgo(90) },
        // B: різниця 30 днів (3-тє замовлення не впливає)
        { companyId: 'b', createdAt: daysAgo(80) },
        { companyId: 'b', createdAt: daysAgo(50) },
        { companyId: 'b', createdAt: daysAgo(10) },
        // C: лише одне
        { companyId: 'c', createdAt: daysAgo(40) },
      ],
    })
    const r = await computeRetentionReport(db, { agencyId: 'agency-1', now: NOW })
    expect(r.companiesWithOrders).toBe(3)
    expect(r.companiesWithRepeat).toBe(2)
    expect(r.repeatRatePct).toBe('66.7')
    expect(r.medianDaysToSecondOrder).toBe(20) // парна: (10+30)/2
  })

  it('конверсія NEW→REGULAR лише серед зрілих (90+ днів) компаній', async () => {
    const db = makeDb({
      companies: [
        { id: 'a', name: 'Зріла-конверт', totalSpent: 1500, createdAt: daysAgo(120) },
        { id: 'b', name: 'Зріла-ні', totalSpent: 300, createdAt: daysAgo(100) },
        { id: 'c', name: 'Молода-багата', totalSpent: 9000, createdAt: daysAgo(10) }, // поза базою
      ],
    })
    const r = await computeRetentionReport(db, { agencyId: 'agency-1', now: NOW })
    expect(r.matureCompanies).toBe(2)
    expect(r.convertedCompanies).toBe(1)
    expect(r.newToRegularPct).toBe('50.0')
  })

  it('активність: <60 active, 60–120 atRisk, >120 churned; платіж теж активність; без подій → createdAt', async () => {
    const db = makeDb({
      companies: [
        { id: 'a', name: 'Активна', createdAt: daysAgo(300) },
        { id: 'b', name: 'Ризикова', createdAt: daysAgo(300) },
        { id: 'c', name: 'Втрачена', createdAt: daysAgo(300) },
        { id: 'd', name: 'Новачок без замовлень', createdAt: daysAgo(5) }, // active від createdAt
      ],
      orders: [
        { companyId: 'b', createdAt: daysAgo(90) }, // atRisk
        { companyId: 'c', createdAt: daysAgo(200) }, // churned…
      ],
      payments: [
        { companyId: 'a', confirmedAt: daysAgo(10) }, // active через платіж
      ],
    })
    const r = await computeRetentionReport(db, { agencyId: 'agency-1', now: NOW })
    expect(r.activity).toEqual({ active: 2, atRisk: 1, churned: 1 })
    // at-risk список: спершу найсвіжіші (менше днів)
    expect(r.atRiskClients.map((c) => c.name)).toEqual(['Ризикова', 'Втрачена'])
    expect(r.atRiskClients[0]).toMatchObject({ daysSince: 90 })
  })

  it('порожня агенція → нулі без ділення на нуль', async () => {
    const r = await computeRetentionReport(makeDb({}), { agencyId: 'agency-1', now: NOW })
    expect(r.totalCompanies).toBe(0)
    expect(r.repeatRatePct).toBe('0.0')
    expect(r.newToRegularPct).toBe('0.0')
    expect(r.medianDaysToSecondOrder).toBeNull()
    expect(r.tierCounts.map((t) => t.count)).toEqual([0, 0, 0, 0])
  })
})
