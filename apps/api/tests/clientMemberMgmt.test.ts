import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PATCH/DELETE /workspace/clients/:id/members/:profileId — agency-side member mgmt (28-Б).
const db = {
  company: { findFirst: vi.fn() },
  companyMember: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OTHER_AGENCY = 'agency-2'
const COMPANY = 'company-1'
const TARGET = 'profile-x'

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
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const memberUrl = `/workspace/clients/${COMPANY}/members/${TARGET}`
const memberRow = {
  role: 'member',
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  profile: { id: TARGET, name: 'Сергій', email: 's@x.com' },
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('PATCH /workspace/clients/:id/members/:profileId — change role', () => {
  it('owner promotes a member to owner', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'member' })
    db.companyMember.update.mockResolvedValue({ ...memberRow, role: 'owner' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.member).toMatchObject({ profileId: TARGET, role: 'owner' })
    expect(db.companyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_profileId: { companyId: COMPANY, profileId: TARGET } },
        data: { role: 'owner' },
      })
    )
    await app.close()
  })

  it('refuses to demote the last owner (409)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'owner' })
    db.companyMember.count.mockResolvedValue(1) // only owner
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'member' },
    })
    expect(res.statusCode).toBe(409)
    expect(db.companyMember.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('demotes an owner when others remain', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'owner' })
    db.companyMember.count.mockResolvedValue(2)
    db.companyMember.update.mockResolvedValue({ ...memberRow, role: 'member' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'member' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('is 404 for a company in another tenant', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('a non-owner (executor) is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an invalid role (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'superadmin' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'PATCH', url: memberUrl, payload: { role: 'owner' } })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('DELETE /workspace/clients/:id/members/:profileId — remove', () => {
  it('owner removes a member', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'member' })
    db.companyMember.delete.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ removed: TARGET })
    expect(db.companyMember.delete).toHaveBeenCalledWith({
      where: { companyId_profileId: { companyId: COMPANY, profileId: TARGET } },
    })
    await app.close()
  })

  it('refuses to remove the last owner (409)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'owner' })
    db.companyMember.count.mockResolvedValue(1)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    expect(db.companyMember.delete).not.toHaveBeenCalled()
    await app.close()
  })

  it('a non-owner is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })
})
