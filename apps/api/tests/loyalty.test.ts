import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const companyFindUnique = vi.fn()
const companyFindMany = vi.fn()
const companyUpdate = vi.fn()
const paymentAggregate = vi.fn()
const historyFindMany = vi.fn()
const historyCreate = vi.fn()
const auditLogCreate = vi.fn()

let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v)
  const prisma = {
    company: { findUnique: companyFindUnique, findMany: companyFindMany, update: companyUpdate },
    payment: { aggregate: paymentAggregate },
    loyaltyTierHistory: { findMany: historyFindMany, create: historyCreate },
    auditLog: { create: auditLogCreate },
  }
  return {
    prisma,
    Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { recalcLoyaltyTiers } = await import('../src/services/loyaltyRecalc.js')
const { buildApp } = await import('../src/app.js')

const mockTx = {
  company: { findMany: companyFindMany, update: companyUpdate },
  payment: { aggregate: paymentAggregate },
  loyaltyTierHistory: { create: historyCreate },
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
  auditLogCreate.mockResolvedValue({})
  companyUpdate.mockResolvedValue({})
  historyCreate.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
describe('recalcLoyaltyTiers (service)', () => {
  it('upgrades NEW → REGULAR at the 1000 threshold + writes history + totalSpent', async () => {
    companyFindMany.mockResolvedValue([
      { id: 'c1', agencyId: 'agency-1', loyaltyTier: 'new', tierOverride: null },
    ])
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('1500.00') } })
    const res = await recalcLoyaltyTiers(mockTx as never, {})
    expect(res).toEqual({ scanned: 1, upgraded: 1 })
    const update = companyUpdate.mock.calls[0][0].data
    expect(update.loyaltyTier).toBe('regular')
    expect(update.totalSpent.toFixed(2)).toBe('1500.00')
    expect(historyCreate.mock.calls[0][0].data).toMatchObject({
      fromTier: 'new',
      toTier: 'regular',
    })
  })

  it('never downgrades (lifetime below current tier) but still refreshes totalSpent', async () => {
    companyFindMany.mockResolvedValue([
      { id: 'c1', agencyId: 'agency-1', loyaltyTier: 'vip', tierOverride: null },
    ])
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('200.00') } })
    const res = await recalcLoyaltyTiers(mockTx as never, {})
    expect(res.upgraded).toBe(0)
    expect(companyUpdate.mock.calls[0][0].data.loyaltyTier).toBeUndefined() // no tier change
    expect(companyUpdate.mock.calls[0][0].data.totalSpent.toFixed(2)).toBe('200.00')
    expect(historyCreate).not.toHaveBeenCalled()
  })

  it('respects tierOverride: never auto-moves a pinned tier', async () => {
    companyFindMany.mockResolvedValue([
      { id: 'c1', agencyId: 'agency-1', loyaltyTier: 'new', tierOverride: 'vip' },
    ])
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('20000.00') } })
    const res = await recalcLoyaltyTiers(mockTx as never, {})
    expect(res.upgraded).toBe(0)
    expect(companyUpdate.mock.calls[0][0].data.loyaltyTier).toBeUndefined()
    expect(historyCreate).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /loyalty/tiers (public)', () => {
  it('returns the tier table without auth', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/loyalty/tiers' })
    expect(res.statusCode).toBe(200)
    const tiers = res.json().data.tiers
    expect(tiers).toHaveLength(4)
    expect(tiers[0]).toEqual({ tier: 'new', thresholdUsd: 0, discountPercent: 0 })
    expect(tiers[3]).toEqual({ tier: 'vip', thresholdUsd: 15000, discountPercent: 12 })
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /workspace/companies/:id/loyalty', () => {
  it('internal team sees tier + progress + history', async () => {
    companyFindUnique.mockResolvedValue({
      id: COMPANY_ID,
      agencyId: 'agency-1',
      loyaltyTier: 'regular',
      tierOverride: null,
    })
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('1500.00') } })
    historyFindMany.mockResolvedValue([
      { fromTier: 'new', toTier: 'regular', reason: 'auto_recalc', createdAt: new Date() },
    ])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/companies/${COMPANY_ID}/loyalty`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const d = res.json().data
    expect(d.effectiveTier).toBe('regular')
    expect(d.discountPercent).toBe(3)
    expect(d.lifetimePaidUsd).toBe('1500.00')
    // progress toward PARTNER (5000): remaining 3500
    expect(d.progress).toEqual({
      nextTier: 'partner',
      nextThresholdUsd: 5000,
      remainingUsd: '3500.00',
    })
    expect(d.history).toHaveLength(1)
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/companies/${COMPANY_ID}/loyalty`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 cross-tenant company', async () => {
    companyFindUnique.mockResolvedValue({
      id: COMPANY_ID,
      agencyId: 'agency-OTHER',
      loyaltyTier: 'new',
      tierOverride: null,
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/companies/${COMPANY_ID}/loyalty`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('POST /workspace/companies/:id/loyalty/override-discount', () => {
  it('owner pins a tier override (+ audit)', async () => {
    companyFindUnique.mockResolvedValue({
      id: COMPANY_ID,
      agencyId: 'agency-1',
      tierOverride: null,
    })
    companyUpdate.mockResolvedValue({ id: COMPANY_ID, loyaltyTier: 'new', tierOverride: 'vip' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/companies/${COMPANY_ID}/loyalty/override-discount`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tier: 'vip' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.effectiveTier).toBe('vip')
    expect(res.json().data.discountPercent).toBe(12)
    expect(companyUpdate.mock.calls[0][0].data.tierOverride).toBe('vip')
    expect(auditLogCreate).toHaveBeenCalled()
    await app.close()
  })

  it('owner can clear the override (tier=null)', async () => {
    companyFindUnique.mockResolvedValue({
      id: COMPANY_ID,
      agencyId: 'agency-1',
      tierOverride: 'vip',
    })
    companyUpdate.mockResolvedValue({ id: COMPANY_ID, loyaltyTier: 'regular', tierOverride: null })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/companies/${COMPANY_ID}/loyalty/override-discount`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tier: null },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.effectiveTier).toBe('regular') // falls back to earned
    await app.close()
  })

  it('non-owner executor cannot override (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/companies/${COMPANY_ID}/loyalty/override-discount`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tier: 'vip' },
    })
    expect(res.statusCode).toBe(403)
    expect(companyUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('400 on an invalid tier', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/companies/${COMPANY_ID}/loyalty/override-discount`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tier: 'platinum' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
