import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// DSN-2: нові зрізи звітів — departments / timesheet / audit (owner-only)
const teamFindMany = vi.fn()
const timeLogGroupBy = vi.fn()
const timeLogFindMany = vi.fn()
const taskFindMany = vi.fn()
const taskGroupBy = vi.fn()
const auditFindMany = vi.fn()

const db = {
  team: { findMany: teamFindMany },
  timeLog: { groupBy: timeLogGroupBy, findMany: timeLogFindMany },
  internalTask: { findMany: taskFindMany, groupBy: taskGroupBy },
  auditLog: { findMany: auditFindMany },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  return {
    prisma: db,
    Prisma: actual.Prisma,
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
  memberships: [],
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

describe('DSN-2 ops-звіти', () => {
  it('departments: години/throughput/cycle/utilization по підрозділах', async () => {
    teamFindMany.mockResolvedValue([
      {
        id: 't1',
        name: 'Dev',
        color: '#22c55e',
        lead: { name: 'Петро' },
        members: [
          { profileId: 'exec-1', weeklyCapacityHours: 40 },
          { profileId: 'exec-2', weeklyCapacityHours: null },
        ],
      },
    ])
    timeLogGroupBy.mockResolvedValue([
      { executorId: 'exec-1', _sum: { hours: 30 } },
      { executorId: 'exec-2', _sum: { hours: 10 } },
    ])
    taskFindMany.mockResolvedValue([
      {
        teamId: 't1',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-05T00:00:00Z'),
      },
    ])
    taskGroupBy.mockResolvedValue([{ teamId: 't1', _count: { _all: 3 } }])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/departments?from=2026-07-01&to=2026-07-07',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const row = res.json().data.departments[0]
    expect(row.hours).toBe(40)
    expect(row.tasksDone).toBe(1)
    expect(row.tasksActive).toBe(3)
    expect(row.avgCycleDays).toBe(4)
    expect(row.leadName).toBe('Петро')
    // 80 год capacity за тиждень → 40/80 = 50%
    expect(row.utilizationPct).toBe(50)
    await app.close()
  })

  it('timesheet: плоскі записи з виконавцем/замовленням/клієнтом', async () => {
    timeLogFindMany.mockResolvedValue([
      {
        id: 'l1',
        date: new Date('2026-07-07'),
        hours: 2.5,
        comment: 'верстка',
        executor: { id: 'exec-1', name: 'Петро' },
        order: { id: 'o1', title: 'Сайт', company: { name: 'ТОВ Тест' } },
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/timesheet?from=2026-07-01&to=2026-07-07',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const e = res.json().data.entries[0]
    expect(e.hours).toBe(2.5)
    expect(e.companyName).toBe('ТОВ Тест')
    await app.close()
  })

  it('audit: список подій з actorName + system-розбивкою; executor → 403', async () => {
    auditFindMany.mockResolvedValue([
      {
        id: 'a1',
        createdAt: new Date(),
        action: 'order.deleted',
        resourceType: 'order',
        resourceId: 'o1',
        result: 'allowed',
        metadata: null,
        actor: { name: 'Owner' },
        actorId: 'owner-1',
      },
      {
        id: 'a2',
        createdAt: new Date(),
        action: 'cron.dunning',
        resourceType: null,
        resourceId: null,
        result: 'allowed',
        metadata: null,
        actor: null,
        actorId: null,
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/audit',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json().data
    expect(body.counts).toEqual({ total: 2, user: 1, system: 1 })
    expect(body.events[1].actorName).toBe('system')

    const { app: app2, token: execToken } = await authed(EXECUTOR)
    const denied = await app2.inject({
      method: 'GET',
      url: '/workspace/reports/audit',
      headers: { authorization: `Bearer ${execToken}` },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
    await app2.close()
  })
})
