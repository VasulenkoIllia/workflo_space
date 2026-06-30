import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const db = { agencyMember: { findUnique: vi.fn(), update: vi.fn() } }

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
const TARGET = 'exec-9'
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
const url = `/workspace/executors/${TARGET}/capacity`
const patch = (
  app: Awaited<ReturnType<typeof authed>>['app'],
  token: string | null,
  body: unknown
) =>
  app.inject({
    method: 'PATCH',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body as object,
  })

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('PATCH /workspace/executors/:id/capacity', () => {
  it('owner sets a weekly capacity norm', async () => {
    db.agencyMember.findUnique.mockResolvedValue({ id: 'am1' })
    db.agencyMember.update.mockResolvedValue({ profileId: TARGET, weeklyCapacityHours: 30 })
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, { weeklyCapacityHours: 30 })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.member.weeklyCapacityHours).toBe(30)
    expect(db.agencyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId_profileId: { agencyId: AGENCY, profileId: TARGET } },
        data: { weeklyCapacityHours: 30 },
      })
    )
    await app.close()
  })

  it('owner clears the norm with null', async () => {
    db.agencyMember.findUnique.mockResolvedValue({ id: 'am1' })
    db.agencyMember.update.mockResolvedValue({ profileId: TARGET, weeklyCapacityHours: null })
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, { weeklyCapacityHours: null })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('is 404 for an unknown member', async () => {
    db.agencyMember.findUnique.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, { weeklyCapacityHours: 30 })
    expect(res.statusCode).toBe(404)
    expect(db.agencyMember.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('a non-owner (executor) is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await patch(app, token, { weeklyCapacityHours: 30 })
    expect(res.statusCode).toBe(403)
    expect(db.agencyMember.findUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an out-of-range norm (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, { weeklyCapacityHours: 999 })
    expect(res.statusCode).toBe(400)
    expect(db.agencyMember.findUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await patch(app, null, { weeklyCapacityHours: 30 })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
