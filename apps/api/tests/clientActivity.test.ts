import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// GET /workspace/clients/:id/activity — агрегований timeline для 360° «Активність».
const db = {
  company: { findFirst: vi.fn() },
  activityLog: { findMany: vi.fn().mockResolvedValue([]) },
  payment: { findMany: vi.fn().mockResolvedValue([]) },
  document: { findMany: vi.fn().mockResolvedValue([]) },
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
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}
const MANAGER = {
  ...OWNER,
  sub: 'manager-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
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

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

const url = `/workspace/clients/${COMPANY}/activity`

beforeEach(() => {
  vi.clearAllMocks()
  db.activityLog.findMany.mockResolvedValue([])
  db.payment.findMany.mockResolvedValue([])
  db.document.findMany.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('GET /workspace/clients/:id/activity', () => {
  it('merges orders + payments + documents, sorted by time desc', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.activityLog.findMany.mockResolvedValue([
      {
        id: 'l1',
        action: 'status_changed',
        createdAt: new Date('2026-07-05T10:00:00Z'),
        orderId: 'ord-1',
        order: { title: 'Лендінг' },
        actor: { name: 'Петро' },
      },
    ])
    db.payment.findMany.mockResolvedValue([
      {
        id: 'p1',
        amount: '500.00',
        currency: 'USD',
        type: 'final',
        confirmedAt: new Date('2026-07-07T09:00:00Z'),
        orderId: 'ord-1',
      },
    ])
    db.document.findMany.mockResolvedValue([
      {
        id: 'd1',
        type: 'invoice',
        number: 'INV-1',
        status: 'sent',
        sentAt: new Date('2026-07-06T08:00:00Z'),
        acceptedAt: null,
        orderId: 'ord-1',
      },
    ])
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().data.items
    expect(items).toHaveLength(3)
    // відсортовано desc: платіж(07) → док(06) → статус(05)
    expect(items[0].kind).toBe('payment')
    expect(items[0].title).toContain('500.00')
    expect(items[1].kind).toBe('document')
    expect(items[2].kind).toBe('order')
    expect(items[2].actorName).toBe('Петро')
    await app.close()
  })

  it('404 for a company of another agency (IDOR)', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('manager is forbidden (403) — фін-таб internal-non-manager', async () => {
    const { app } = await authed(MANAGER)
    const token = app.jwt.sign(MANAGER)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app } = await authed(CLIENT)
    const token = app.jwt.sign(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
