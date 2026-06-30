import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const db = { timeLog: { findMany: vi.fn() } }

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { computeHoursReport, hoursReportToCsv } = await import('../src/services/hoursReport.js')

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
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

const ROWS = [
  {
    hours: 3,
    executorId: 'e1',
    orderId: 'o1',
    executor: { name: 'Іван' },
    order: { id: 'o1', title: 'Замовлення A', estimatedHours: 10, project: { name: 'Alpha' } },
  },
  {
    hours: 4,
    executorId: 'e2',
    orderId: 'o1',
    executor: { name: 'Петро' },
    order: { id: 'o1', title: 'Замовлення A', estimatedHours: 10, project: { name: 'Alpha' } },
  },
  {
    hours: 2,
    executorId: 'e1',
    orderId: 'o2',
    executor: { name: 'Іван' },
    order: { id: 'o2', title: 'Замовлення B', estimatedHours: null, project: null },
  },
]

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('computeHoursReport — aggregation', () => {
  it('rolls up logged vs estimate per order + per executor with variance', async () => {
    db.timeLog.findMany.mockResolvedValue(ROWS)
    const r = await computeHoursReport(db as never, {
      agencyId: AGENCY,
      from: '2026-06-01',
      to: '2026-06-30',
    })

    // window filter + running-timer exclusion in the where clause
    expect(db.timeLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agencyId: AGENCY,
          date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') },
          OR: [{ startedAt: null }, { endedAt: { not: null } }],
        }),
      })
    )

    const o1 = r.byOrder.find((o) => o.orderId === 'o1')!
    expect(o1).toMatchObject({
      loggedHours: 7,
      estimatedHours: 10,
      variance: -3,
      projectName: 'Alpha',
    })
    const o2 = r.byOrder.find((o) => o.orderId === 'o2')!
    expect(o2).toMatchObject({ loggedHours: 2, estimatedHours: null, variance: null })

    expect(r.byExecutor.find((e) => e.executorId === 'e1')!.loggedHours).toBe(5)
    expect(r.byExecutor.find((e) => e.executorId === 'e2')!.loggedHours).toBe(4)
    // only o1 contributes an estimate
    expect(r.totals).toEqual({ estimatedHours: 10, loggedHours: 9, variance: -1 })
  })

  it('CSV has an order section + an executor section', () => {
    const csv = hoursReportToCsv({
      from: '2026-06-01',
      to: '2026-06-30',
      byOrder: [
        {
          orderId: 'o1',
          title: 'A',
          projectName: 'Alpha',
          estimatedHours: 10,
          loggedHours: 7,
          variance: -3,
        },
      ],
      byExecutor: [{ executorId: 'e1', name: 'Іван', loggedHours: 5 }],
      totals: { estimatedHours: 10, loggedHours: 7, variance: -3 },
    })
    expect(csv).toContain('Замовлення,Проєкт,Оцінка (год),Факт (год),Відхилення (год)')
    expect(csv).toContain('Виконавець,Факт (год)')
    expect(csv).toContain('"Іван",5')
  })
})

describe('GET /workspace/reports/hours', () => {
  it('owner gets the report (200)', async () => {
    db.timeLog.findMany.mockResolvedValue(ROWS)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/hours?from=2026-06-01&to=2026-06-30',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.totals.loggedHours).toBe(9)
    await app.close()
  })

  it('a non-owner (executor) is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/hours?from=2026-06-01&to=2026-06-30',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.timeLog.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects a missing date range (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/hours',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/reports/hours?from=2026-06-01&to=2026-06-30',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
