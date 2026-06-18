import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const companyFindFirst = vi.fn()
const projectFindFirst = vi.fn()
const orderCreate = vi.fn()
const auditLogCreate = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  const prisma = {
    company: { findFirst: companyFindFirst },
    project: { findFirst: projectFindFirst },
    order: { create: orderCreate },
    auditLog: { create: auditLogCreate },
  }
  return {
    ...actual,
    prisma,
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const COMPANY = '11111111-1111-4111-8111-111111111111'

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
  activeCompanyId: COMPANY,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: COMPANY, role: 'owner' as const }],
}

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

function post(token: string, app: Awaited<ReturnType<typeof authed>>['app'], body: unknown) {
  return app.inject({
    method: 'POST',
    url: '/workspace/orders',
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  auditLogCreate.mockResolvedValue({})
})
afterEach(() => vi.clearAllMocks())

describe('POST /workspace/orders — internal team creates a task for a client (P-7)', () => {
  it('owner creates a zeroBilled internal_task for a chosen client', async () => {
    companyFindFirst.mockResolvedValue({ id: COMPANY })
    orderCreate.mockResolvedValue({
      id: 'order-1',
      title: 'Профілактика',
      companyId: COMPANY,
      type: 'internal_task',
      zeroBilled: true,
      projectId: null,
      priority: 'medium',
      internalStatus: 'new',
      clientStatus: 'in_progress',
      deadline: null,
      createdAt: new Date(),
    })
    const { app, token } = await authed(OWNER)
    const res = await post(token, app, {
      companyId: COMPANY,
      title: 'Профілактика',
      zeroBilled: true,
    })
    expect(res.statusCode).toBe(201)
    const data = orderCreate.mock.calls[0][0].data
    expect(data.company.connect.id).toBe(COMPANY) // explicit company, not the session
    expect(data.type).toBe('internal_task') // default for the workspace create
    expect(data.zeroBilled).toBe(true) // team's choice
    expect(data.createdBy.connect.id).toBe('owner-1')
    await app.close()
  })

  it('a client cannot create via the workspace route (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await post(token, app, { companyId: COMPANY, title: 'Спроба' })
    expect(res.statusCode).toBe(403)
    expect(orderCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('404 when the target company is not in the tenant', async () => {
    companyFindFirst.mockResolvedValue(null) // cross-tenant / unknown company
    const { app, token } = await authed(OWNER)
    const res = await post(token, app, { companyId: COMPANY, title: 'Завдання' })
    expect(res.statusCode).toBe(404)
    expect(orderCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('404 when the linked project does not belong to the company', async () => {
    companyFindFirst.mockResolvedValue({ id: COMPANY })
    projectFindFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await post(token, app, {
      companyId: COMPANY,
      title: 'Завдання',
      projectId: '22222222-2222-4222-8222-222222222222',
    })
    expect(res.statusCode).toBe(404)
    expect(orderCreate).not.toHaveBeenCalled()
    await app.close()
  })
})
