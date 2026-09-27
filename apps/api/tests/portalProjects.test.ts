import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const projectFindMany = vi.fn()
const projectFindFirst = vi.fn()
const orderCount = vi.fn()
const timeLogAggregate = vi.fn() // DSN-5: години поточного циклу
let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  Dec = (v: string | number) => new actual.Prisma.Decimal(v)
  const prisma = {
    project: { findMany: projectFindMany, findFirst: projectFindFirst },
    order: { count: orderCount },
    timeLog: { aggregate: timeLogAggregate },
  }
  return {
    prisma,
    Prisma: actual.Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/saas/limits.js', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  moduleEnabled: vi.fn().mockResolvedValue(true),
}))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const COMPANY = 'company-1'
const CLIENT = {
  sub: 'p1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: COMPANY,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: COMPANY, role: 'owner' as const }],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /portal/projects — client reads own projects', () => {
  it('returns a client-safe project list scoped to the active company', async () => {
    projectFindMany.mockResolvedValue([
      {
        id: 'pr1',
        name: 'Підтримка',
        type: 'support',
        billingModel: 'fixed_monthly_advance',
        currency: 'UAH',
        abonAmount: Dec('5000'),
        clientHourlyRate: null,
        billingCycle: 'monthly_day_n',
        includedHoursCap: Dec('20'),
        paymentTermsDays: 7,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        nextCycleAt: null,
      },
    ])
    timeLogAggregate.mockResolvedValue({ _sum: { hours: Dec('12.5') } })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/projects',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const projects = res.json().data.projects
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({
      id: 'pr1',
      name: 'Підтримка',
      billingModel: 'fixed_monthly_advance',
      abonAmount: '5000.00',
      includedHoursCap: '20.00',
    })
    // DSN-5: години поточного циклу (якоря нема → календарний місяць) по замовленнях проєкту
    expect(projects[0].cycle.hoursUsed).toBe(12.5)
    expect(projects[0].nextCycleAt).toBeNull()
    const aggArg = timeLogAggregate.mock.calls[0]![0] as {
      where: { order: { projectId: string }; date: { gte: Date; lt: Date } }
    }
    expect(aggArg.where.order.projectId).toBe('pr1')
    expect(aggArg.where.date.gte.getUTCDate()).toBe(1)
    // client-safe: internal fields are NOT exposed
    expect(projects[0]).not.toHaveProperty('legalEntityId')
    expect(projects[0]).not.toHaveProperty('advanceGatePct')
    expect(projects[0]).not.toHaveProperty('invoiceApprover')
    // scoped to {agencyId, companyId}
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId: AGENCY, companyId: COMPANY } })
    )
    await app.close()
  })

  it('DSN-6: протухлий якір циклу (крон ще не зсунув) → nextCycleAt клієнту в майбутньому', async () => {
    projectFindMany.mockResolvedValue([
      {
        id: 'pr2',
        name: 'Абонплата',
        type: 'support',
        billingModel: 'fixed_monthly_advance',
        currency: 'USD',
        abonAmount: Dec('300'),
        clientHourlyRate: null,
        billingCycle: 'monthly_day_n',
        includedHoursCap: null,
        paymentTermsDays: 7,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        nextCycleAt: new Date('2020-01-01T00:00:00Z'), // давно в минулому
      },
    ])
    timeLogAggregate.mockResolvedValue({ _sum: { hours: null } })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/projects',
      headers: { authorization: `Bearer ${token}` },
    })
    const p = res.json().data.projects[0]
    expect(new Date(p.nextCycleAt).getTime()).toBeGreaterThan(Date.now())
    expect(p.nextCycleAt).toBe(p.cycle.to)
    expect(new Date(p.nextCycleAt).getUTCDate()).toBe(1) // день якоря збережено
    await app.close()
  })

  it('is 400 when the account has no active company', async () => {
    const { app, token } = await authed({ ...CLIENT, activeCompanyId: null })
    const res = await app.inject({
      method: 'GET',
      url: '/portal/projects',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(projectFindMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(CLIENT)
    const res = await app.inject({ method: 'GET', url: '/portal/projects' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('DSN-7 GET /workspace/projects/:id — KPI-статистика проєкту 360', () => {
  it('години поточного циклу, відкриті замовлення, наступний білінг після «зараз»', async () => {
    projectFindFirst.mockResolvedValue({
      id: 'pr9',
      agencyId: AGENCY,
      companyId: COMPANY,
      name: 'Супровід',
      billingModel: 'fixed_monthly_advance',
      billingCycle: 'monthly_day_n',
      nextCycleAt: new Date('2020-03-01T00:00:00Z'), // протухлий якір
      currency: 'USD',
      abonAmount: Dec('300'),
      active: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    timeLogAggregate.mockResolvedValue({ _sum: { hours: Dec('7.25') } })
    orderCount.mockResolvedValue(2)
    const OWNER = {
      sub: 'o1',
      email: 'o@e.com',
      role: 'owner' as const,
      activeAgencyId: AGENCY,
      activeCompanyId: null,
      agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
      memberships: [],
    }
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/projects/pr9',
      headers: { authorization: `Bearer ${token}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const { stats } = res.json().data
    expect(stats.cycle.hoursUsed).toBe(7.25)
    expect(stats.openOrders).toBe(2)
    expect(new Date(stats.nextCycleAt).getTime()).toBeGreaterThan(Date.now())
    expect(orderCount.mock.calls[0][0].where).toMatchObject({ projectId: 'pr9', deletedAt: null })
  })
})
