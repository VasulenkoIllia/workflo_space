import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const db = {
  lead: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  company: { findFirst: vi.fn() },
  order: { create: vi.fn() },
  $executeRaw: vi.fn().mockResolvedValue(1),
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

const leadRow = (over: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  name: 'Acme deal',
  contactName: null,
  email: null,
  phone: null,
  source: null,
  status: 'new',
  estimatedValue: null,
  currency: 'USD',
  notes: null,
  assigneeId: null,
  companyId: null,
  convertedOrderId: null,
  lostReason: null,
  position: 0,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-01T00:00:00Z'),
  ...over,
})

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /workspace/leads', () => {
  it('returns the agency leads for a team member, status-filterable', async () => {
    db.lead.findMany.mockResolvedValue([leadRow()])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads?status=new',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.leads).toHaveLength(1)
    expect(db.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId: AGENCY, status: 'new' } })
    )
    await app.close()
  })

  it('rejects an invalid status (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads?status=bogus',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('a client (not team) is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.lead.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'GET', url: '/workspace/leads' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('GET /workspace/leads/:id', () => {
  it('returns a single lead scoped to the agency', async () => {
    db.lead.findFirst.mockResolvedValue(leadRow())
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads/lead-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.lead.id).toBe('lead-1')
    expect(db.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lead-1', agencyId: AGENCY } })
    )
    await app.close()
  })

  it('is 404 for a lead in another tenant', async () => {
    db.lead.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/leads/lead-x',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('POST /workspace/leads', () => {
  it('creates a lead (201, agency-bound, USD default)', async () => {
    db.lead.create.mockResolvedValue(leadRow({ name: 'New deal' }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New deal', source: 'website' },
    })
    expect(res.statusCode).toBe(201)
    const arg = db.lead.create.mock.calls[0]![0] as {
      data: { agency: { connect: { id: string } } }
    }
    expect(arg.data.agency.connect.id).toBe(AGENCY)
    await app.close()
  })

  it('rejects a missing name (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'website' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('PATCH /workspace/leads/:id', () => {
  it('updates the stage, scoped to the agency', async () => {
    db.lead.findFirst.mockResolvedValue({ id: 'lead-1' })
    db.lead.update.mockResolvedValue(leadRow({ status: 'qualified' }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/leads/lead-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'qualified' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.lead.status).toBe('qualified')
    await app.close()
  })

  it('is 404 for a lead in another tenant', async () => {
    db.lead.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/leads/lead-x',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'qualified' },
    })
    expect(res.statusCode).toBe(404)
    expect(db.lead.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an empty body (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/leads/lead-1',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('refuses to set status=won directly — won only via convert (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/leads/lead-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'won' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.lead.findFirst).not.toHaveBeenCalled()
    expect(db.lead.update).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /workspace/leads/:id/convert', () => {
  it('converts a lead into a client order and links both sides', async () => {
    db.lead.findFirst.mockResolvedValue({ id: 'lead-1', name: 'Acme deal', convertedOrderId: null })
    db.company.findFirst.mockResolvedValue({ id: 'company-1' })
    db.order.create.mockResolvedValue({ id: 'order-9' })
    db.lead.update.mockResolvedValue(
      leadRow({ status: 'won', companyId: 'company-1', convertedOrderId: 'order-9' })
    )
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leads/lead-1/convert',
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: 'company-1' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.orderId).toBe('order-9')
    expect(res.json().data.lead.status).toBe('won')
    // order bound to the lead's agency + chosen company, titled from the lead
    const oArg = db.order.create.mock.calls[0]![0] as {
      data: {
        agency: { connect: { id: string } }
        company: { connect: { id: string } }
        title: string
      }
    }
    expect(oArg.data.agency.connect.id).toBe(AGENCY)
    expect(oArg.data.company.connect.id).toBe('company-1')
    expect(oArg.data.title).toBe('Acme deal')
    await app.close()
  })

  it('refuses to convert an already-converted lead (409)', async () => {
    db.lead.findFirst.mockResolvedValue({ id: 'lead-1', name: 'X', convertedOrderId: 'order-old' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leads/lead-1/convert',
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: 'company-1' },
    })
    expect(res.statusCode).toBe(409)
    expect(db.order.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('is 404 when the chosen company is in another tenant', async () => {
    db.lead.findFirst.mockResolvedValue({ id: 'lead-1', name: 'X', convertedOrderId: null })
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/leads/lead-1/convert',
      headers: { authorization: `Bearer ${token}` },
      payload: { companyId: 'company-x' },
    })
    expect(res.statusCode).toBe(404)
    expect(db.order.create).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('DELETE /workspace/leads/:id', () => {
  it('deletes a lead (agency-scoped)', async () => {
    db.lead.deleteMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/leads/lead-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.lead.deleteMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', agencyId: AGENCY },
    })
    await app.close()
  })

  it('is 404 when nothing was deleted (other tenant / missing)', async () => {
    db.lead.deleteMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/leads/lead-x',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
