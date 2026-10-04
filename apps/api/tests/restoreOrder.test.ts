import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S10-07: soft-delete restore («кошик») — owner-only, вікно 30 днів.
const db = {
  order: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  agency: { findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
const writeAuditAsync = vi.fn()
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync }))

const { buildApp } = await import('../src/app.js')

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

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const DAY_MS = 86_400_000

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /workspace/orders/deleted — кошик', () => {
  it('owner lists recently-deleted orders with daysLeft', async () => {
    const deletedAt = new Date(Date.now() - 5 * DAY_MS)
    db.order.findMany.mockResolvedValue([
      { id: 'o-1', title: 'Видалене', deletedAt, company: { name: 'ТОВ' } },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/orders/deleted',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json().data.orders as { id: string; daysLeft: number }[]
    expect(rows[0]!.id).toBe('o-1')
    expect(rows[0]!.daysLeft).toBe(25)
    // 30-денне вікно у where
    const arg = db.order.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(arg.where).toHaveProperty('deletedAt')
    await app.close()
  })

  it('executor is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/orders/deleted',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('POST /workspace/orders/:id/restore', () => {
  it('restores a deleted order within the window (audited)', async () => {
    db.order.findFirst.mockResolvedValue({
      id: 'o-1',
      deletedAt: new Date(Date.now() - 5 * DAY_MS),
    })
    db.order.update.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/orders/o-1/restore',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'o-1' },
      data: { deletedAt: null },
    })
    const audit = writeAuditAsync.mock.calls[0]![1] as { action: string }
    expect(audit.action).toBe('order.restored')
    await app.close()
  })

  it('past the 30-day window → 410, no write', async () => {
    db.order.findFirst.mockResolvedValue({
      id: 'o-1',
      deletedAt: new Date(Date.now() - 31 * DAY_MS),
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/orders/o-1/restore',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(410)
    expect(db.order.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('not-deleted or foreign order → 404', async () => {
    db.order.findFirst.mockResolvedValue({ id: 'o-1', deletedAt: null })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/orders/o-1/restore',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
