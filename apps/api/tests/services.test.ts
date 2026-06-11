import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const serviceFindMany = vi.fn()
const serviceCreate = vi.fn()
const serviceFindUnique = vi.fn()
const serviceUpdate = vi.fn()
const serviceDelete = vi.fn()
const csFindUnique = vi.fn()
const csCreate = vi.fn()
const csUpdate = vi.fn()
const csCount = vi.fn()
const csFindMany = vi.fn()
const companyFindUnique = vi.fn()
const chargeCreateMany = vi.fn()
const auditLogCreate = vi.fn()
// AR-11: charge generation refreshes Company.moneyBalance per affected company.
const companyUpdate = vi.fn()
const paymentAggregate = vi.fn()
const walletTxAggregate = vi.fn()
const queryRaw = vi.fn((strings: TemplateStringsArray) => {
  const sql = Array.isArray(strings) ? strings.join('?') : String(strings)
  if (sql.includes('"companies"') && sql.includes('FOR UPDATE'))
    return Promise.resolve([{ id: COMPANY_ID, agencyId: 'agency-1' }])
  if (sql.includes('"service_charges"') && sql.includes('charged'))
    return Promise.resolve([{ charged: 0 }])
  return Promise.resolve([])
})

let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v)
  const prisma = {
    service: {
      findMany: serviceFindMany,
      create: serviceCreate,
      findUnique: serviceFindUnique,
      update: serviceUpdate,
      delete: serviceDelete,
    },
    companyService: {
      findUnique: csFindUnique,
      create: csCreate,
      update: csUpdate,
      count: csCount,
      findMany: csFindMany,
    },
    company: { findUnique: companyFindUnique, update: companyUpdate },
    serviceCharge: { createMany: chargeCreateMany },
    payment: { aggregate: paymentAggregate },
    walletTransaction: { aggregate: walletTxAggregate },
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

const helpers = await import('../src/services/recurringCharges.js')
const cron = await import('../src/cron/recurringCharges.js')
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
const CLIENT = {
  sub: 'p1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const SERVICE_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

function svcRow(over: Record<string, unknown> = {}) {
  return {
    id: SERVICE_ID,
    name: 'SEO',
    description: null,
    isActive: true,
    isRecurring: true,
    defaultPriceUsd: Dec('100.00'),
    createdAt: new Date('2026-06-08T00:00:00Z'),
    _count: { companyAssigns: 0 },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  auditLogCreate.mockResolvedValue({})
  // AR-11 recompute defaults (no payments / no bonus spends / write ok).
  paymentAggregate.mockResolvedValue({ _sum: { amountUsd: null } })
  walletTxAggregate.mockResolvedValue({ _sum: { amount: null } })
  companyUpdate.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
describe('services catalog', () => {
  it('executor lists agency services', async () => {
    serviceFindMany.mockResolvedValue([svcRow()])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/services',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.services[0].defaultPriceUsd).toBe('100.00')
    expect(serviceFindMany.mock.calls[0][0].where.agencyId).toBe('agency-1')
    await app.close()
  })

  it('client cannot list (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/services',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('executor creates a service (201, tenant-stamped)', async () => {
    serviceCreate.mockResolvedValue(svcRow())
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/services',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'SEO', defaultPriceUsd: 100 },
    })
    expect(res.statusCode).toBe(201)
    expect(serviceCreate.mock.calls[0][0].data.agencyId).toBe('agency-1')
    await app.close()
  })

  it('400 on a too-short name', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/services',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('PATCH renames a service (200)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    serviceUpdate.mockResolvedValue(svcRow({ name: 'SEO Pro' }))
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/services/${SERVICE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'SEO Pro' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('PATCH price change blocked while active subscriptions exist (409)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    csCount.mockResolvedValue(2)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/services/${SERVICE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { defaultPriceUsd: 200 },
    })
    expect(res.statusCode).toBe(409)
    expect(serviceUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('PATCH price change allowed when no active subscriptions (200)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    csCount.mockResolvedValue(0)
    serviceUpdate.mockResolvedValue(svcRow({ defaultPriceUsd: Dec('200.00') }))
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/services/${SERVICE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { defaultPriceUsd: 200 },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('PATCH 404 cross-tenant', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-OTHER' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/services/${SERVICE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Nope' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('DELETE blocked while subscriptions exist (409)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    csCount.mockResolvedValue(1)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: `/workspace/services/${SERVICE_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    expect(serviceDelete).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE succeeds with no subscriptions (200)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    csCount.mockResolvedValue(0)
    serviceDelete.mockResolvedValue({ id: SERVICE_ID })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: `/workspace/services/${SERVICE_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(serviceDelete).toHaveBeenCalled()
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('service assignments', () => {
  const assignmentRow = {
    id: 'cs-1',
    companyId: COMPANY_ID,
    serviceId: SERVICE_ID,
    customPrice: undefined as unknown,
    frequency: 'monthly',
    active: true,
    nextChargeAt: new Date('2026-07-01T00:00:00Z'),
  }

  it('assigns a company → 201, nextChargeAt = first of next month', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-1' })
    csFindUnique.mockResolvedValue(null)
    csCreate.mockResolvedValue({ ...assignmentRow, customPrice: Dec('50.00') })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/services/${SERVICE_ID}/assign`,
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: COMPANY_ID, customPrice: 50 },
    })
    expect(res.statusCode).toBe(201)
    const nextChargeAt: Date = csCreate.mock.calls[0][0].data.nextChargeAt
    expect(nextChargeAt.getUTCDate()).toBe(1)
    expect(nextChargeAt.getTime()).toBeGreaterThan(Date.now())
    await app.close()
  })

  it('409 when already subscribed (active)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-1' })
    csFindUnique.mockResolvedValue({ id: 'cs-1', active: true })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/services/${SERVICE_ID}/assign`,
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: COMPANY_ID, customPrice: 50 },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('reactivates a cancelled subscription (201, update path)', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-1' })
    csFindUnique.mockResolvedValue({ id: 'cs-1', active: false })
    csUpdate.mockResolvedValue({ ...assignmentRow, customPrice: Dec('60.00') })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/services/${SERVICE_ID}/assign`,
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: COMPANY_ID, customPrice: 60 },
    })
    expect(res.statusCode).toBe(201)
    expect(csUpdate.mock.calls[0][0].data.active).toBe(true)
    expect(csCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('404 when the company is in another tenant', async () => {
    serviceFindUnique.mockResolvedValue({ id: SERVICE_ID, agencyId: 'agency-1' })
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-OTHER' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/services/${SERVICE_ID}/assign`,
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: COMPANY_ID, customPrice: 50 },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('client cannot assign (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/services/${SERVICE_ID}/assign`,
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: COMPANY_ID, customPrice: 50 },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('unassign soft-cancels (active=false, nextChargeAt cleared)', async () => {
    csFindUnique.mockResolvedValue({ id: 'cs-1', company: { agencyId: 'agency-1' } })
    csUpdate.mockResolvedValue({})
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: `/workspace/services/${SERVICE_ID}/companies/${COMPANY_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(csUpdate.mock.calls[0][0].data).toEqual({ active: false, nextChargeAt: null })
    await app.close()
  })

  it('PATCH assignment 404 cross-tenant', async () => {
    csFindUnique.mockResolvedValue({ id: 'cs-1', company: { agencyId: 'agency-OTHER' } })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: `/workspace/services/${SERVICE_ID}/companies/${COMPANY_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { customPrice: 75 },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('POST /workspace/billing/charges/generate', () => {
  it('executor generates for a month (200, created count, discount applied)', async () => {
    csFindMany.mockResolvedValue([
      {
        id: 'cs-1',
        customPrice: Dec('100.00'),
        frequency: 'monthly',
        nextChargeAt: new Date('2026-06-01T00:00:00Z'),
        companyId: COMPANY_ID,
        company: {
          agencyId: 'agency-1',
          currency: 'USD',
          loyaltyTier: 'regular',
          tierOverride: null,
        },
      },
    ])
    chargeCreateMany.mockResolvedValue({ count: 1 })
    csUpdate.mockResolvedValue({})
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/billing/charges/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { month: '2026-06' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ created: 1, due: 1 })
    // REGULAR tier = 3% off 100 → total 97.00 owed.
    const row = chargeCreateMany.mock.calls[0][0].data[0]
    expect(row.totalAmount.toFixed(2)).toBe('97.00')
    expect(row.amount.toFixed(2)).toBe('97.00')
    expect(row.discountAmount.toFixed(2)).toBe('3.00')
    expect(csUpdate.mock.calls[0][0].data.nextChargeAt.getUTCMonth()).toBe(6) // advanced to July
    await app.close()
  })

  it('client cannot generate (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/billing/charges/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { month: '2026-06' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('400 on a malformed month', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/billing/charges/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { month: 'June' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('recurringCharges helpers (pure)', () => {
  it('startOfMonthUtc normalizes to the 1st 00:00 UTC', () => {
    const r = helpers.startOfMonthUtc(new Date('2026-06-17T12:34:00Z'))
    expect(r.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('addFrequency advances by the right number of months', () => {
    const base = new Date('2026-06-01T00:00:00Z')
    expect(helpers.addFrequency(base, 'monthly').toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(helpers.addFrequency(base, 'quarterly').toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(helpers.addFrequency(base, 'annual').toISOString()).toBe('2027-06-01T00:00:00.000Z')
  })

  it('endOfMonthUtc returns the last instant of the month', () => {
    expect(helpers.endOfMonthUtc('2026-06').toISOString()).toBe('2026-06-30T23:59:59.999Z')
    expect(helpers.endOfMonthUtc('2026-12').toISOString()).toBe('2026-12-31T23:59:59.999Z')
  })

  it('msUntilNextMonthStart is positive and lands on a 1st', () => {
    const now = new Date('2026-06-17T12:00:00Z')
    const ms = cron.msUntilNextMonthStart(0, 5, now)
    expect(ms).toBeGreaterThan(0)
    const fireAt = new Date(now.getTime() + ms)
    expect(fireAt.getUTCDate()).toBe(1)
    expect(fireAt.getUTCMonth()).toBe(6) // July
  })

  it('computeChargeAmounts applies the tier discount', () => {
    const base = Dec('100.00') as never
    const at = (tier: string) => helpers.computeChargeAmounts(base, tier as never)
    expect(at('new').totalAmount.toFixed(2)).toBe('100.00')
    expect(at('regular').totalAmount.toFixed(2)).toBe('97.00')
    expect(at('partner').totalAmount.toFixed(2)).toBe('93.00')
    expect(at('vip').totalAmount.toFixed(2)).toBe('88.00')
  })
})
