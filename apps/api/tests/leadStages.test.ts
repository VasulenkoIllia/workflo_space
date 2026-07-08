import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ХВІСТ-4: CRUD кастомних стадій воронки лідів.
const db = {
  leadStage: {
    count: vi.fn().mockResolvedValue(6),
    createMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    aggregate: vi.fn().mockResolvedValue({ _max: { position: 3 } }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
  },
  lead: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

beforeEach(() => {
  vi.clearAllMocks()
  db.leadStage.count.mockResolvedValue(6)
  db.leadStage.findMany.mockResolvedValue([])
  db.leadStage.aggregate.mockResolvedValue({ _max: { position: 3 } })
  db.leadStage.delete.mockResolvedValue({})
  db.lead.updateMany.mockResolvedValue({ count: 0 })
})
afterEach(() => vi.clearAllMocks())

describe('lead stages CRUD (ХВІСТ-4)', () => {
  it('GET lists stages sorted open→won→lost (team)', async () => {
    db.leadStage.findMany.mockResolvedValue([
      { id: 's5', name: 'Втрачено', kind: 'lost', position: 5 },
      { id: 's4', name: 'Виграно', kind: 'won', position: 4 },
      { id: 's1', name: 'Новий', kind: 'open', position: 0 },
    ])
    const { app } = await authed(EXECUTOR)
    const token = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/lead-stages',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const stages = res.json().data.stages
    expect(stages.map((s: { kind: string }) => s.kind)).toEqual(['open', 'won', 'lost'])
    await app.close()
  })

  it('owner creates an open stage at max-open+1; executor 403', async () => {
    db.leadStage.findFirst.mockResolvedValue(null) // no dup
    db.leadStage.create.mockResolvedValue({ id: 's-new', name: 'Демо', kind: 'open', position: 4 })
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/lead-stages',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Демо' },
    })
    expect(res.statusCode).toBe(201)
    expect(db.leadStage.create.mock.calls[0][0].data).toMatchObject({ kind: 'open', position: 4 })

    const etoken = app.jwt.sign(EXECUTOR)
    const denied = await app.inject({
      method: 'POST',
      url: '/workspace/lead-stages',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { name: 'X' },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('400 on duplicate stage name', async () => {
    db.leadStage.findFirst.mockResolvedValue({ id: 'dup' })
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/lead-stages',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Новий' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('DELETE open stage reassigns leads to another open stage', async () => {
    db.leadStage.findFirst
      .mockResolvedValueOnce({ id: 's-open', kind: 'open' }) // the stage being deleted
      .mockResolvedValueOnce({ id: 's-fallback' }) // fallback open stage
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/lead-stages/s-open',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.lead.updateMany.mock.calls[0][0].data).toEqual({ stageId: 's-fallback' })
    expect(db.leadStage.delete).toHaveBeenCalledOnce()
    await app.close()
  })

  it('400 deleting a terminal (won/lost) stage', async () => {
    db.leadStage.findFirst.mockResolvedValueOnce({ id: 's-won', kind: 'won' })
    const { app } = await authed(OWNER)
    const token = app.jwt.sign(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/lead-stages/s-won',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(db.leadStage.delete).not.toHaveBeenCalled()
    await app.close()
  })
})
