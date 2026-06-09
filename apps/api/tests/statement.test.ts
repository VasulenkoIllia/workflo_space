import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const companyFindUnique = vi.fn()
const chargeFindMany = vi.fn()
const paymentFindMany = vi.fn()
const txnFindMany = vi.fn()

let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v)
  const prisma = {
    company: { findUnique: companyFindUnique },
    serviceCharge: { findMany: chargeFindMany },
    payment: { findMany: paymentFindMany },
    walletTransaction: { findMany: txnFindMany },
  }
  return {
    prisma,
    Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { buildApp } = await import('../src/app.js')

const CLIENT = {
  sub: 'p1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
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

const COMPANY_ID = '22222222-2222-4222-8222-222222222222'

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
describe('GET /portal/wallet/statement', () => {
  it('merges charges + payments + bonus into one date-sorted timeline with balances', async () => {
    companyFindUnique.mockResolvedValue({
      id: 'company-1',
      agencyId: 'agency-1',
      bonusBalance: Dec('15.00'),
      moneyBalance: Dec('20.00'),
    })
    chargeFindMany.mockResolvedValue([
      {
        id: 'ch1',
        totalAmount: Dec('100.00'),
        amount: Dec('100.00'),
        currency: 'USD',
        status: 'pending',
        month: new Date('2026-06-01T00:00:00Z'),
        createdAt: new Date('2026-06-02T00:00:00Z'),
      },
    ])
    paymentFindMany.mockResolvedValue([
      {
        id: 'pay1',
        amount: Dec('80.00'),
        amountUsd: Dec('80.00'),
        currency: 'USD',
        type: 'final',
        provider: 'manual',
        confirmedAt: new Date('2026-06-03T00:00:00Z'),
      },
    ])
    txnFindMany.mockResolvedValue([
      {
        id: 'wt1',
        type: 'credit',
        source: 'referral_bonus',
        amount: Dec('15.00'),
        balanceAfter: Dec('15.00'),
        sourceId: 'rb1',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
    ])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/wallet/statement',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const d = res.json().data
    expect(d.bonus.balance).toBe('15.00')
    expect(d.money).toEqual({ balance: '20.00', status: 'prepaid' })
    // sorted oldest → newest: bonus(06-01) → charge(06-02) → payment(06-03)
    expect(d.timeline.map((e: { kind: string }) => e.kind)).toEqual(['bonus', 'charge', 'payment'])
    // portal omits sourceId tracing
    expect(d.timeline[0].detail.sourceId).toBeUndefined()
    await app.close()
  })

  it('money.status is owing when moneyBalance < 0', async () => {
    companyFindUnique.mockResolvedValue({
      id: 'company-1',
      agencyId: 'agency-1',
      bonusBalance: Dec('0.00'),
      moneyBalance: Dec('-50.00'),
    })
    chargeFindMany.mockResolvedValue([])
    paymentFindMany.mockResolvedValue([])
    txnFindMany.mockResolvedValue([])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/wallet/statement?from=2026-06-01&to=2026-06-30',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.money.status).toBe('owing')
    await app.close()
  })

  it('400 with no active company', async () => {
    const { app, token } = await authed({ ...CLIENT, activeCompanyId: null })
    const res = await app.inject({
      method: 'GET',
      url: '/portal/wallet/statement',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('GET /admin/wallet/companies/:id/statement', () => {
  it('internal team gets a statement with sourceId tracing', async () => {
    companyFindUnique.mockResolvedValue({
      id: COMPANY_ID,
      agencyId: 'agency-1',
      bonusBalance: Dec('0.00'),
      moneyBalance: Dec('0.00'),
    })
    chargeFindMany.mockResolvedValue([])
    paymentFindMany.mockResolvedValue([])
    txnFindMany.mockResolvedValue([
      {
        id: 'wt1',
        type: 'debit',
        source: 'invoice_payment',
        amount: Dec('10.00'),
        balanceAfter: Dec('0.00'),
        sourceId: 'ch1',
        createdAt: new Date('2026-06-05T00:00:00Z'),
      },
    ])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/admin/wallet/companies/${COMPANY_ID}/statement`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.money.status).toBe('settled')
    expect(res.json().data.timeline[0].detail.sourceId).toBe('ch1')
    await app.close()
  })

  it('client cannot read the admin statement (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: `/admin/wallet/companies/${COMPANY_ID}/statement`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('POST /portal/invoices/:chargeId/pay-with-bonus (guards)', () => {
  it('401 without a token', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: `/portal/invoices/${COMPANY_ID}/pay-with-bonus`,
      payload: {},
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('400 with no active company', async () => {
    const { app, token } = await authed({ ...CLIENT, activeCompanyId: null })
    const res = await app.inject({
      method: 'POST',
      url: `/portal/invoices/${COMPANY_ID}/pay-with-bonus`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('400 on a malformed amount (>2 decimals)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/invoices/${COMPANY_ID}/pay-with-bonus`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 10.123 },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
