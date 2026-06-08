import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const referralSettingsFindUnique = vi.fn()
const referralSettingsUpsert = vi.fn()
const auditLogCreate = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const prisma = {
    referralSettings: { findUnique: referralSettingsFindUnique, upsert: referralSettingsUpsert },
    auditLog: { create: auditLogCreate },
  }
  return {
    prisma,
    Prisma: actual.Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { getReferralPercent, DEFAULT_REFERRAL_TIERS } = await import('@workflo/types')
const { parseReferralTiers } = await import('../src/services/referral.js')
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
describe('getReferralPercent (pure)', () => {
  it('returns 0 for an empty tier table', () => {
    expect(getReferralPercent([], 9999)).toBe(0)
  })

  it('picks the applicable tier by referrer lifetime', () => {
    const tiers = DEFAULT_REFERRAL_TIERS // 0→5, 5000→7, 15000→10
    expect(getReferralPercent(tiers, 0)).toBe(5)
    expect(getReferralPercent(tiers, 4999)).toBe(5)
    expect(getReferralPercent(tiers, 5000)).toBe(7)
    expect(getReferralPercent(tiers, 14999)).toBe(7)
    expect(getReferralPercent(tiers, 15000)).toBe(10)
    expect(getReferralPercent(tiers, 999999)).toBe(10)
  })
})

describe('parseReferralTiers', () => {
  it('keeps a valid tier list', () => {
    const tiers = [{ minPaidUsd: 0, percent: 4 }]
    expect(parseReferralTiers(tiers)).toEqual(tiers)
  })

  it('falls back to defaults on empty/malformed input', () => {
    expect(parseReferralTiers([])).toEqual(DEFAULT_REFERRAL_TIERS)
    expect(parseReferralTiers(null)).toEqual(DEFAULT_REFERRAL_TIERS)
    expect(parseReferralTiers([{ percent: 'x' }])).toEqual(DEFAULT_REFERRAL_TIERS)
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /admin/referral/settings', () => {
  it('internal team gets defaults when no settings row exists', async () => {
    referralSettingsFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.enabled).toBe(true)
    expect(res.json().data.tiers).toEqual(DEFAULT_REFERRAL_TIERS)
    await app.close()
  })

  it('returns the stored config when a row exists', async () => {
    referralSettingsFindUnique.mockResolvedValue({
      enabled: false,
      tiers: [{ minPaidUsd: 0, percent: 8 }],
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.enabled).toBe(false)
    expect(res.json().data.tiers).toEqual([{ minPaidUsd: 0, percent: 8 }])
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('PATCH /admin/referral/settings', () => {
  it('owner updates tiers (upsert + audit)', async () => {
    referralSettingsUpsert.mockResolvedValue({
      enabled: true,
      tiers: [{ minPaidUsd: 0, percent: 6 }],
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { tiers: [{ minPaidUsd: 0, percent: 6 }] },
    })
    expect(res.statusCode).toBe(200)
    expect(referralSettingsUpsert.mock.calls[0][0].where.agencyId).toBe('agency-1')
    expect(auditLogCreate).toHaveBeenCalled()
    await app.close()
  })

  it('non-owner executor cannot update (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(403)
    expect(referralSettingsUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('400 on an invalid tier (percent > 100)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { tiers: [{ minPaidUsd: 0, percent: 150 }] },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('400 on an empty body', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/referral/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
