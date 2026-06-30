import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const projectFindMany = vi.fn()
let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  Dec = (v: string | number) => new actual.Prisma.Decimal(v)
  const prisma = { project: { findMany: projectFindMany } }
  return {
    prisma,
    Prisma: actual.Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

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
      },
    ])
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
