import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S11-01: глобальний FTS-пошук — role-скоуп + tsquery-білдер.
const queryRaw = vi.fn()
const db = {
  $queryRaw: queryRaw,
  agency: { findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
    enterAgencyContext: vi.fn(),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { buildTsQuery } = await import('../src/routes/search.js')

const AGENCY = 'agency-1'
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  role: 'executor' as const,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}
const CLIENT = {
  ...OWNER,
  sub: 'client-1',
  role: 'client' as const,
  agencyMemberships: [],
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  queryRaw.mockResolvedValue([])
})

describe('buildTsQuery', () => {
  it('останнє слово — префіксне, решта — точні, AND', () => {
    expect(buildTsQuery('лендінг під ключ')).toBe('лендінг & під & ключ:*')
    expect(buildTsQuery('лен')).toBe('лен:*')
  })
  it('спецсимволи tsquery ріжуться сплітом (інʼєкція неможлива)', () => {
    expect(buildTsQuery("a' | b & c!")).toBe('a & b & c:*')
  })
  it('самі розділювачі → null', () => {
    expect(buildTsQuery('&& || !!')).toBeNull()
  })
})

describe('GET /workspace/search', () => {
  it('owner отримує всі 4 групи (4 raw-запити)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/search?q=лендінг',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ orders: [], companies: [], leads: [], projects: [] })
    expect(queryRaw).toHaveBeenCalledTimes(4)
    await app.close()
  })

  it('executor: без клієнтів/лідів (2 запити — orders + projects)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/search?q=лендінг',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(queryRaw).toHaveBeenCalledTimes(2)
    await app.close()
  })

  it('клієнт → 403; короткий q → 400', async () => {
    const { app, token } = await authed(CLIENT)
    const denied = await app.inject({
      method: 'GET',
      url: '/workspace/search?q=лендінг',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(denied.statusCode).toBe(403)

    const otoken = app.jwt.sign(OWNER as object)
    const short = await app.inject({
      method: 'GET',
      url: '/workspace/search?q=л',
      headers: { authorization: `Bearer ${otoken}` },
    })
    expect(short.statusCode).toBe(400)
    await app.close()
  })
})
