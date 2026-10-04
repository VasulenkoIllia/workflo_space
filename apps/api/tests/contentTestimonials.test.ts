import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// TESTIMONIALS: відгуки лендінга — owner-CRUD + публічний read (лише published).
const tFindMany = vi.fn()
const tCreate = vi.fn()
const tUpdate = vi.fn()
const tDelete = vi.fn()

const db = {
  testimonial: { findMany: tFindMany, create: tCreate, update: tUpdate, delete: tDelete },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
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
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('TESTIMONIALS /content + /workspace/content/testimonials', () => {
  it('публічний GET віддає ЛИШЕ published, featured перші (без auth)', async () => {
    tFindMany.mockResolvedValue([])
    const app = buildApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/content/testimonials' })
    expect(res.statusCode).toBe(200)
    const where = tFindMany.mock.calls[0][0].where
    expect(where).toEqual({ published: true })
    expect(tFindMany.mock.calls[0][0].orderBy[0]).toEqual({ featured: 'desc' })
    await app.close()
  })

  it('owner створює чернетку (published=false); rating поза 1-5 → 400', async () => {
    tCreate.mockResolvedValue({ id: 't-1', authorName: 'Олена', rating: 5, published: false })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/content/testimonials',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        authorName: 'Олена Брунь',
        company: 'Brunky',
        text: 'Чудова робота команди!',
        rating: 5,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(tCreate.mock.calls[0][0].data.published).toBe(false)

    const bad = await app.inject({
      method: 'POST',
      url: '/workspace/content/testimonials',
      headers: { authorization: `Bearer ${token}` },
      payload: { authorName: 'Олена Брунь', text: 'Чудова робота команди!', rating: 7 },
    })
    expect(bad.statusCode).toBe(400)
    await app.close()
  })

  it('executor 403 на workspace-CRUD', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/content/testimonials',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('PATCH publish/unpublish + featured; unknown id → 404', async () => {
    tUpdate.mockResolvedValue({ id: 't-1', published: true, featured: true })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/content/testimonials/t-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { published: true, featured: true },
    })
    expect(res.statusCode).toBe(200)
    expect(tUpdate.mock.calls[0][0].data).toEqual({ published: true, featured: true })
    await app.close()
  })
})
