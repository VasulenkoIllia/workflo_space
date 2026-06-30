import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const db = { internalTask: { findMany: vi.fn() } }

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
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
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const TASK = {
  id: 't1',
  title: 'Завдання',
  status: 'todo',
  assigneeId: 'exec-1',
  position: 0,
  updatedAt: new Date('2026-06-29T00:00:00Z'),
  order: { id: 'o1', title: 'Замовлення A' },
  assignee: { id: 'exec-1', name: 'Іван' },
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /workspace/tasks — global board', () => {
  it('returns all agency tasks (with order + assignee) for a team member', async () => {
    db.internalTask.findMany.mockResolvedValue([TASK])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/tasks',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const tasks = res.json().data.tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: 't1', order: { id: 'o1' }, assignee: { name: 'Іван' } })
    expect(db.internalTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId: AGENCY } })
    )
    await app.close()
  })

  it('passes assignee + status filters into the query', async () => {
    db.internalTask.findMany.mockResolvedValue([])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/tasks?assigneeId=exec-1&status=in_progress',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.internalTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId: AGENCY, assigneeId: 'exec-1', status: 'in_progress' },
      })
    )
    await app.close()
  })

  it('rejects an invalid status (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/tasks?status=bogus',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(db.internalTask.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('a client (not team) is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/tasks',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.internalTask.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'GET', url: '/workspace/tasks' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
