import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// GET /workspace/clients/:id/members — client roster for the 360° «Люди» tab.
const db = {
  company: { findFirst: vi.fn() },
  companyMember: { findMany: vi.fn() },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const COMPANY = 'company-1'

const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: COMPANY,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: COMPANY, role: 'owner' as const }],
}
const MANAGER = {
  sub: 'manager-1',
  email: 'm@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const url = `/workspace/clients/${COMPANY}/members`

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /workspace/clients/:id/members', () => {
  it('returns the roster for an owner, tenant-scoped', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findMany.mockResolvedValue([
      {
        role: 'owner',
        joinedAt: new Date('2026-01-01T00:00:00Z'),
        profile: { id: 'p-1', name: 'Анна', email: 'anna@x.com' },
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const members = res.json().data.members
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ profileId: 'p-1', name: 'Анна', role: 'owner' })
    // company lookup is tenant-scoped; roster is keyed by the resolved company id.
    expect(db.company.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: COMPANY, agencyId: AGENCY } })
    )
    expect(db.companyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY } })
    )
    await app.close()
  })

  it('is 404 for a company in another tenant (no roster leak)', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(db.companyMember.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('a client cannot read the team roster (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('a manager is blocked (403)', async () => {
    const { app, token } = await authed(MANAGER)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'GET', url })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
