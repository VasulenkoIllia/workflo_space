import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const paymentAggregate = vi.fn()
const paymentRefundAggregate = vi.fn() // HIGH-2: нетто-виручка (мінус повернення)
const expenseFindMany = vi.fn()
const expenseFindUnique = vi.fn()
const expenseCreate = vi.fn()
const expenseUpdate = vi.fn()
const expenseDelete = vi.fn()
const rateFindMany = vi.fn()
const laborRawMock = vi.fn() // ХВІСТ-3: $queryRaw погодинної собівартості
const exchangeRateFindUnique = vi.fn()
const auditLogCreate = vi.fn()

let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v)
  const prisma = {
    payment: { aggregate: paymentAggregate },
    paymentRefund: { aggregate: paymentRefundAggregate },
    expense: {
      findMany: expenseFindMany,
      findUnique: expenseFindUnique,
      create: expenseCreate,
      update: expenseUpdate,
      delete: expenseDelete,
    },
    executorRate: { findMany: rateFindMany },
    exchangeRate: { findUnique: exchangeRateFindUnique },
    auditLog: { create: auditLogCreate },
    // ХВІСТ-3: погодинна собівартість праці (Σ hours×costRateUsd по виконавцях)
    $queryRaw: laborRawMock,
  }
  return {
    prisma,
    Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { computePnl, pnlToCsv } = await import('../src/services/pnl.js')
const { buildApp } = await import('../src/app.js')

const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}

const EXPENSE_ID = '44444444-4444-4444-8444-444444444444'

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  auditLogCreate.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
describe('computePnl (service)', () => {
  function setup(
    over: {
      revenue?: string
      expenses?: unknown[]
      rates?: unknown[]
      rate?: { usdToUah: unknown } | null
      labor?: Array<{ executorId: string; cost: string }>
      refunds?: string
    } = {}
  ) {
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec(over.revenue ?? '0') } })
    paymentRefundAggregate.mockResolvedValue({ _sum: { amountUsd: Dec(over.refunds ?? '0') } })
    expenseFindMany.mockResolvedValue(over.expenses ?? [])
    rateFindMany.mockResolvedValue(over.rates ?? [])
    exchangeRateFindUnique.mockResolvedValue(over.rate ?? null)
    laborRawMock.mockResolvedValue(over.labor ?? [])
  }

  it('netProfit = revenue − (normalized expenses + ExecutorRate salary); margin computed', async () => {
    setup({
      revenue: '10000.00',
      expenses: [
        {
          type: 'recurring',
          category: 'software',
          amount: Dec('1000.00'),
          currency: 'USD',
          frequency: 'monthly',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: null,
        },
      ],
      rates: [
        {
          monthlySalary: Dec('2000.00'),
          currency: 'USD',
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveUntil: null,
        },
      ],
    })
    const pnl = await computePnl({ agencyId: 'agency-1', from: '2026-06-01', to: '2026-06-30' })
    expect(pnl.revenueUsd).toBe('10000.00')
    expect(pnl.salaryUsd).toBe('2000.00')
    expect(pnl.expensesUsd).toBe('3000.00') // 1000 software + 2000 salary
    expect(pnl.netProfitUsd).toBe('7000.00')
    expect(pnl.marginPct).toBe('70.00')
  })

  it('ХВІСТ-3: hourly labor cost — тільки для несалярних (salaried час не подвоюємо)', async () => {
    setup({
      revenue: '10000.00',
      rates: [
        {
          executorId: 'salaried-1',
          monthlySalary: Dec('2000.00'),
          currency: 'USD',
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveUntil: null,
        },
      ],
      // salaried-1 наробив час (не рахуємо — покрито окладом); hourly-1 → у витрати
      labor: [
        { executorId: 'salaried-1', cost: '900.00' },
        { executorId: 'hourly-1', cost: '600.00' },
      ],
    })
    const pnl = await computePnl({ agencyId: 'agency-1', from: '2026-06-01', to: '2026-06-30' })
    expect(pnl.salaryUsd).toBe('2000.00')
    expect(pnl.laborHourlyUsd).toBe('600.00') // лише hourly-1, salaried-1 виключено
    expect(pnl.expensesUsd).toBe('2600.00') // 2000 оклад + 600 погодинна праця
    expect(pnl.byCategory.find((c) => c.category === 'labor_hourly')?.amountUsd).toBe('600.00')
    expect(pnl.netProfitUsd).toBe('7400.00')
  })

  it('HIGH-2: виручка НЕТТО — часткові повернення віднімаються (маржа не завищена)', async () => {
    setup({ revenue: '10000.00', refunds: '2500.00' })
    const pnl = await computePnl({ agencyId: 'agency-1', from: '2026-06-01', to: '2026-06-30' })
    // 10000 confirmed − 2500 повернень = 7500 нетто-виручки (без витрат → = netProfit)
    expect(pnl.revenueUsd).toBe('7500.00')
    expect(pnl.netProfitUsd).toBe('7500.00')
    expect(pnl.marginPct).toBe('100.00')
  })

  it('normalizes a quarterly expense to a monthly run-rate', async () => {
    setup({
      revenue: '0',
      expenses: [
        {
          type: 'recurring',
          category: 'rent',
          amount: Dec('3000.00'),
          currency: 'USD',
          frequency: 'quarterly',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: null,
        },
      ],
    })
    const pnl = await computePnl({ agencyId: 'agency-1', from: '2026-06-01', to: '2026-06-30' })
    expect(pnl.expensesUsd).toBe('1000.00') // 3000 / 3
  })

  it('excludes manual category=salary (ExecutorRate is the single salary source)', async () => {
    setup({
      revenue: '0',
      expenses: [
        {
          type: 'recurring',
          category: 'salary',
          amount: Dec('5000.00'),
          currency: 'USD',
          frequency: 'monthly',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: null,
        },
      ],
      rates: [
        {
          monthlySalary: Dec('2000.00'),
          currency: 'USD',
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveUntil: null,
        },
      ],
    })
    const pnl = await computePnl({ agencyId: 'agency-1', from: '2026-06-01', to: '2026-06-30' })
    // only the rate salary (2000) counts — the manual 5000 salary line is ignored
    expect(pnl.expensesUsd).toBe('2000.00')
    expect(pnl.salaryUsd).toBe('2000.00')
  })

  it('normalizes a UAH expense to USD via the exchange rate', async () => {
    setup({
      revenue: '0',
      expenses: [
        {
          type: 'one_time',
          category: 'marketing',
          amount: Dec('4000.00'),
          currency: 'UAH',
          frequency: null,
          startDate: new Date('2026-06-10T00:00:00Z'),
          endDate: null,
        },
      ],
      rate: { usdToUah: Dec('40.0000') },
    })
    const pnl = await computePnl({ agencyId: 'agency-1', from: '2026-06-01', to: '2026-06-30' })
    expect(pnl.expensesUsd).toBe('100.00') // 4000 UAH / 40
  })
})

describe('pnlToCsv', () => {
  it('renders header + category lines + summary rows', () => {
    const csv = pnlToCsv({
      from: '2026-06-01',
      to: '2026-06-30',
      revenueUsd: '10000.00',
      expensesUsd: '3000.00',
      salaryUsd: '2000.00',
      netProfitUsd: '7000.00',
      marginPct: '70.00',
      byCategory: [{ category: 'software', amountUsd: '1000.00' }],
    })
    expect(csv.split('\n')[0]).toBe('category,amountUsd')
    expect(csv).toContain('software,1000.00')
    expect(csv).toContain('net_profit,7000.00')
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('expenses CRUD', () => {
  it('owner creates an expense (201, source=manual)', async () => {
    expenseCreate.mockResolvedValue({
      id: EXPENSE_ID,
      type: 'recurring',
      category: 'software',
      source: 'manual',
      vendor: null,
      amount: Dec('99.00'),
      currency: 'USD',
      frequency: 'monthly',
      startDate: new Date('2026-06-01'),
      endDate: null,
      executorId: null,
      isActive: true,
      createdAt: new Date(),
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/expenses',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'recurring',
        category: 'software',
        amount: 99,
        frequency: 'monthly',
        startDate: '2026-06-01',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(expenseCreate.mock.calls[0][0].data.source).toBe('manual')
    await app.close()
  })

  it('recurring expense without frequency → 400', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/expenses',
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'recurring', category: 'software', amount: 99, startDate: '2026-06-01' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('non-owner executor cannot create (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/expenses',
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'one_time', category: 'other', amount: 10, startDate: '2026-06-01' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('hard-delete of an active expense → 409 (archive first)', async () => {
    expenseFindUnique.mockResolvedValue({ id: EXPENSE_ID, agencyId: 'agency-1', isActive: true })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `/workspace/expenses/${EXPENSE_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    expect(expenseDelete).not.toHaveBeenCalled()
    await app.close()
  })

  it('hard-delete of an archived expense → 200', async () => {
    expenseFindUnique.mockResolvedValue({ id: EXPENSE_ID, agencyId: 'agency-1', isActive: false })
    expenseDelete.mockResolvedValue({ id: EXPENSE_ID })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `/workspace/expenses/${EXPENSE_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(expenseDelete).toHaveBeenCalled()
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /workspace/reports/pnl', () => {
  it('owner gets the P&L; CSV variant sets text/csv', async () => {
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('0') } })
    paymentRefundAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('0') } })
    expenseFindMany.mockResolvedValue([])
    rateFindMany.mockResolvedValue([])
    exchangeRateFindUnique.mockResolvedValue(null)
    laborRawMock.mockResolvedValue([])
    const { app, token } = await authed(OWNER)
    const json = await app.inject({
      method: 'GET',
      url: '/workspace/reports/pnl?from=2026-06-01&to=2026-06-30',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(json.statusCode).toBe(200)
    expect(json.json().data.netProfitUsd).toBe('0.00')

    const csv = await app.inject({
      method: 'GET',
      url: '/workspace/reports/pnl.csv?from=2026-06-01&to=2026-06-30',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(csv.statusCode).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    await app.close()
  })

  it('non-owner executor cannot read P&L (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/pnl?from=2026-06-01&to=2026-06-30',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
