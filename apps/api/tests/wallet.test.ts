import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const companyFindUnique = vi.fn()
const companyFindMany = vi.fn()
const companyCount = vi.fn()
const companyUpdate = vi.fn()
const txnCreate = vi.fn()
const txnFindMany = vi.fn()
const txnCount = vi.fn()
const auditLogCreate = vi.fn()

let lockedCompanyRows: unknown[] = []
const queryRaw = vi.fn(() => Promise.resolve(lockedCompanyRows))

let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v)
  const prisma = {
    company: {
      findUnique: companyFindUnique,
      findMany: companyFindMany,
      count: companyCount,
      update: companyUpdate,
    },
    walletTransaction: { create: txnCreate, findMany: txnFindMany, count: txnCount },
    auditLog: { create: auditLogCreate },
    $queryRaw: queryRaw,
  }
  return {
    prisma,
    Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { buildApp } = await import('../src/app.js')

const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const CLIENT = {
  sub: 'p1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const COMPANY_ID = '22222222-2222-4222-8222-222222222222'

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  lockedCompanyRows = []
  auditLogCreate.mockResolvedValue({})
  companyUpdate.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
describe('GET /portal/wallet', () => {
  it('client sees bonus + money balance', async () => {
    companyFindUnique.mockResolvedValue({
      id: 'company-1',
      agencyId: 'agency-1',
      bonusBalance: Dec('50.00'),
      moneyBalance: Dec('10.00'),
      currency: 'USD',
    })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/wallet',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.bonusBalance).toBe('50.00')
    expect(res.json().data.moneyBalance).toBe('10.00')
    await app.close()
  })

  it('400 with no active company', async () => {
    const { app, token } = await authed({ ...CLIENT, activeCompanyId: null })
    const res = await app.inject({
      method: 'GET',
      url: '/portal/wallet',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('GET /portal/wallet/transactions', () => {
  it('lists the company ledger, type filter applied', async () => {
    txnFindMany.mockResolvedValue([
      {
        id: 'wt1',
        type: 'credit',
        source: 'referral_bonus',
        amount: Dec('25.00'),
        balanceAfter: Dec('75.00'),
        currency: 'USD',
        sourceId: 'rb1',
        note: null,
        createdAt: new Date('2026-06-08T10:00:00Z'),
      },
    ])
    txnCount.mockResolvedValue(1)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/wallet/transactions?type=credit',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.transactions[0].balanceAfter).toBe('75.00')
    const where = txnFindMany.mock.calls[0][0].where
    expect(where.companyId).toBe('company-1')
    expect(where.type).toBe('credit')
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /admin/wallet/companies', () => {
  it('executor lists company balances with search', async () => {
    companyFindMany.mockResolvedValue([
      {
        id: COMPANY_ID,
        name: 'Acme',
        bonusBalance: Dec('100.00'),
        moneyBalance: Dec('0.00'),
        currency: 'USD',
      },
    ])
    companyCount.mockResolvedValue(1)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/admin/wallet/companies?search=Acm',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.companies[0].bonusBalance).toBe('100.00')
    const where = companyFindMany.mock.calls[0][0].where
    expect(where.agencyId).toBe('agency-1')
    expect(where.name).toEqual({ contains: 'Acm', mode: 'insensitive' })
    await app.close()
  })

  it('client cannot list (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/admin/wallet/companies',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('GET /admin/wallet/companies/:id/transactions', () => {
  it('executor reads a company ledger', async () => {
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-1' })
    txnFindMany.mockResolvedValue([])
    txnCount.mockResolvedValue(0)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/admin/wallet/companies/${COMPANY_ID}/transactions`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('403 cross-tenant company', async () => {
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-OTHER' })
    txnFindMany.mockResolvedValue([])
    txnCount.mockResolvedValue(0)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/admin/wallet/companies/${COMPANY_ID}/transactions`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 unknown company', async () => {
    companyFindUnique.mockResolvedValue(null)
    txnFindMany.mockResolvedValue([])
    txnCount.mockResolvedValue(0)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/admin/wallet/companies/${COMPANY_ID}/transactions`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('POST /admin/wallet/companies/:id/adjust', () => {
  function lock(balance: string) {
    lockedCompanyRows = [{ id: COMPANY_ID, agencyId: 'agency-1', bonusBalance: Dec(balance) }]
  }

  it('owner credits → 201, ledger + balance updated, audit', async () => {
    lock('50.00')
    txnCreate.mockResolvedValue({ id: 'wt1', createdAt: new Date('2026-06-08T10:00:00Z') })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/admin/wallet/companies/${COMPANY_ID}/adjust`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'credit', amount: 25, note: 'goodwill' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.transaction.balanceAfter).toBe('75.00')
    // balance cache updated to the new running total
    expect(companyUpdate.mock.calls[0][0].data.bonusBalance.toFixed(2)).toBe('75.00')
    expect(txnCreate.mock.calls[0][0].data.type).toBe('credit')
    expect(auditLogCreate).toHaveBeenCalled()
    await app.close()
  })

  it('owner debits within balance → 201', async () => {
    lock('50.00')
    txnCreate.mockResolvedValue({ id: 'wt2', createdAt: new Date() })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/admin/wallet/companies/${COMPANY_ID}/adjust`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'debit', amount: 20, note: 'correction' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.transaction.balanceAfter).toBe('30.00')
    await app.close()
  })

  it('debit overdraw → 409, no ledger write', async () => {
    lock('5.00')
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/admin/wallet/companies/${COMPANY_ID}/adjust`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'debit', amount: 10, note: 'too much' },
    })
    expect(res.statusCode).toBe(409)
    expect(txnCreate).not.toHaveBeenCalled()
    expect(companyUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('non-owner executor cannot adjust (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/admin/wallet/companies/${COMPANY_ID}/adjust`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'credit', amount: 10, note: 'x' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('400 when note is missing', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/admin/wallet/companies/${COMPANY_ID}/adjust`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'credit', amount: 10 },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('404 cross-tenant company (locked row in another agency)', async () => {
    lockedCompanyRows = [{ id: COMPANY_ID, agencyId: 'agency-OTHER', bonusBalance: Dec('100.00') }]
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/admin/wallet/companies/${COMPANY_ID}/adjust`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'credit', amount: 10, note: 'x' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
