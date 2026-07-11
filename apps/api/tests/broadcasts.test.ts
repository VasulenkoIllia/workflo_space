import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S12-07: розсилки — owner-CRUD + preview-сегменти + атомарний send через outbox.
const db = {
  broadcast: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  companyMember: { findMany: vi.fn() },
  outboxEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

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

const draftRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'bc-1',
  subject: 'Новини агенції',
  body: 'Привіт! Ми оновили портал.',
  segment: 'all',
  tier: null,
  status: 'draft',
  recipientCount: 0,
  sentCount: 0,
  sentAt: null,
  createdAt: new Date(),
  ...over,
})

async function authed(claims: unknown = OWNER) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.auditLog.create.mockResolvedValue({})
  db.companyMember.findMany.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('POST /workspace/broadcasts', () => {
  it('executor → 403; owner створює чернетку; segment=tier без tier → 400', async () => {
    const { app, token } = await authed(EXECUTOR)
    const forbidden = await app.inject({
      method: 'POST',
      url: '/workspace/broadcasts',
      headers: { authorization: `Bearer ${token}` },
      payload: { subject: 'Тест', body: 'Тіло повідомлення' },
    })
    expect(forbidden.statusCode).toBe(403)

    const { app: app2, token: token2 } = await authed()
    db.broadcast.create.mockResolvedValue(draftRow())
    const ok = await app2.inject({
      method: 'POST',
      url: '/workspace/broadcasts',
      headers: { authorization: `Bearer ${token2}` },
      payload: { subject: 'Новини агенції', body: 'Привіт! Ми оновили портал.' },
    })
    expect(ok.statusCode).toBe(201)
    expect(db.broadcast.create.mock.calls[0][0].data).toMatchObject({
      agencyId: AGENCY,
      segment: 'all',
      createdById: 'owner-1',
    })

    const badTier = await app2.inject({
      method: 'POST',
      url: '/workspace/broadcasts',
      headers: { authorization: `Bearer ${token2}` },
      payload: { subject: 'VIP-новини', body: 'Лише для VIP-клієнтів', segment: 'tier' },
    })
    expect(badTier.statusCode).toBe(400)
    await app.close()
    await app2.close()
  })
})

describe('GET /workspace/broadcasts/:id/preview', () => {
  it('дедуп власників компаній сегмента; debtors фільтрує по боргу', async () => {
    db.broadcast.findFirst.mockResolvedValue({ segment: 'debtors', tier: null })
    db.companyMember.findMany.mockResolvedValue([
      { profileId: 'p1' },
      { profileId: 'p1' }, // та сама людина власник 2 компаній → дедуп
      { profileId: 'p2' },
    ])
    const { app, token } = await authed()
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/broadcasts/bc-1/preview',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.recipientCount).toBe(2)
    // сегмент debtors → фільтр по боргу компанії
    expect(db.companyMember.findMany.mock.calls[0][0].where.company).toMatchObject({
      agencyId: AGENCY,
      moneyBalance: { lt: 0 },
    })
    await app.close()
  })
})

describe('POST /workspace/broadcasts/:id/send', () => {
  it('атомарний claim draft→sending + outbox; повторний send → 409', async () => {
    db.broadcast.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    db.broadcast.findFirst.mockResolvedValue({ id: 'bc-1' })
    db.broadcast.findFirstOrThrow.mockResolvedValue(draftRow({ status: 'sending' }))
    db.outboxEvent.create.mockResolvedValue({})
    const { app, token } = await authed()
    const ok = await app.inject({
      method: 'POST',
      url: '/workspace/broadcasts/bc-1/send',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.broadcast.updateMany.mock.calls[0][0].where).toMatchObject({ status: 'draft' })
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1)

    const again = await app.inject({
      method: 'POST',
      url: '/workspace/broadcasts/bc-1/send',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(again.statusCode).toBe(409)
    await app.close()
  })
})

describe('PATCH/DELETE — лише чернетки', () => {
  it('надіслану не правлять і не видаляють → 404', async () => {
    db.broadcast.updateMany.mockResolvedValue({ count: 0 })
    db.broadcast.deleteMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed()
    const patch = await app.inject({
      method: 'PATCH',
      url: '/workspace/broadcasts/bc-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { subject: 'Нова тема', body: 'Нове тіло повідомлення' },
    })
    expect(patch.statusCode).toBe(404)
    const del = await app.inject({
      method: 'DELETE',
      url: '/workspace/broadcasts/bc-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.statusCode).toBe(404)
    await app.close()
  })
})
