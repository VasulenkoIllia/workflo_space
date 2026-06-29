import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// One shared db double drives both withTenant(prisma) and tenantTransaction(tx) — every
// query/mutation the route or its access helpers touch is a configurable vi.fn().
const db = {
  order: { findUnique: vi.fn() },
  document: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  paymentSettings: { findUnique: vi.fn() },
  outboxEvent: { create: vi.fn() },
  $queryRaw: vi.fn(),
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

// Avoid real Chromium/template rendering — assert the route's behaviour, not the PDF bytes.
class ChromiumUnavailableError extends Error {}
const htmlToPdf = vi.fn()
vi.mock('@workflo/templates', () => ({
  ChromiumUnavailableError,
  renderDocumentHtml: () => '<html>doc</html>',
  htmlToPdf: (...args: unknown[]) => htmlToPdf(...args),
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OTHER_AGENCY = 'agency-2'
const COMPANY = 'company-1'
const ORDER = 'order-1'

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
const MANAGER = {
  sub: 'manager-1',
  email: 'm@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
// Same tenant, but belongs to a different company than the order → must not see it.
const OTHER_CLIENT = {
  ...CLIENT,
  sub: 'client-2',
  activeCompanyId: 'company-9',
  memberships: [{ companyId: 'company-9', role: 'owner' as const }],
}

/** Full order row covering every `select` the access helpers + routes use. */
const orderRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: ORDER,
  agencyId: AGENCY,
  companyId: COMPANY,
  deletedAt: null,
  ...over,
})

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('POST /orders/:orderId/documents — generate (team-only)', () => {
  it('a client cannot generate (403) and nothing is written', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'invoice' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('cross-tenant order is refused (403) for a team member of another agency', async () => {
    db.order.findUnique.mockResolvedValue(orderRow({ agencyId: OTHER_AGENCY }))
    const { app, token } = await authed(OWNER) // member of AGENCY, order in OTHER_AGENCY
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'invoice' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('a deleted/missing order is 404', async () => {
    db.order.findUnique.mockResolvedValue(orderRow({ deletedAt: new Date() }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'invoice' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('an order without a company is 400 (cannot bill)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow({ companyId: null }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'invoice' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.document.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an unknown document type with 400', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'totally_made_up' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.document.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('owner generates a numbered, tenant-bound document (201)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.$queryRaw.mockResolvedValue([{ count: 1 }])
    db.document.create.mockResolvedValue({
      id: 'doc-1',
      type: 'invoice',
      number: 'INV-2026-000001',
      status: 'generated',
      generatedAt: new Date('2026-06-01T00:00:00Z'),
      sentAt: null,
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'invoice' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.document.number).toBe('INV-2026-000001')
    // Document is bound to the ORDER's agency + company, created-by the caller.
    const arg = db.document.create.mock.calls[0]![0] as {
      data: Record<string, { connect?: { id: string } }> & { status: string }
    }
    expect(arg.data.agency.connect!.id).toBe(AGENCY)
    expect(arg.data.order.connect!.id).toBe(ORDER)
    expect(arg.data.company.connect!.id).toBe(COMPANY)
    expect(arg.data.createdBy.connect!.id).toBe('owner-1')
    expect(arg.data.status).toBe('generated')
    await app.close()
  })
})

describe('GET /orders/:orderId/documents — list (participant)', () => {
  it("a different company's client (same tenant) gets 404, not the list", async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    const { app, token } = await authed(OTHER_CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(db.document.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it("the order's client sees the list, scoped to the order", async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.document.findMany.mockResolvedValue([
      { id: 'doc-1', type: 'invoice', number: 'INV-2026-000001', status: 'sent' },
    ])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: `/orders/${ORDER}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.documents).toHaveLength(1)
    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: ORDER } })
    )
    await app.close()
  })
})

describe('GET /orders/:orderId/documents/:docId/pdf', () => {
  it('a doc that belongs to another order is not found (404) — query is order-scoped', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.document.findFirst.mockResolvedValue(null) // {id, orderId} miss
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/orders/${ORDER}/documents/doc-from-other-order/pdf`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(db.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-from-other-order', orderId: ORDER },
      })
    )
    await app.close()
  })

  it('serves the HTML fallback (200) when Chromium is unavailable', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.document.findFirst.mockResolvedValue({
      type: 'invoice',
      number: 'INV-2026-000001',
      generatedAt: new Date('2026-06-01T00:00:00Z'),
      agency: { name: 'Acme Agency' },
      order: { title: 'Site', totalAmount: 1000, currency: 'UAH' },
      company: { name: 'Client co', legalName: null, taxId: null, legalAddress: null },
      legalEntity: null,
    })
    htmlToPdf.mockRejectedValue(new ChromiumUnavailableError('no chromium'))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/orders/${ORDER}/documents/doc-1/pdf`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.headers['x-document-format']).toBe('html-fallback')
    await app.close()
  })
})

describe('GET /workspace/clients/:id/documents — client document overview', () => {
  it('lists the client documents scoped to {companyId, agencyId} for an owner', async () => {
    db.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        type: 'invoice',
        number: 'INV-2026-000001',
        status: 'sent',
        order: { id: ORDER, title: 'Site' },
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.documents).toHaveLength(1)
    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY, agencyId: AGENCY } })
    )
    await app.close()
  })

  it('a client cannot read the team document overview (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('a manager is blocked (financial/legal artefacts) — 403', async () => {
    const { app, token } = await authed(MANAGER)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'GET', url: `/workspace/clients/${COMPANY}/documents` })
    expect(res.statusCode).toBe(401)
    expect(db.document.findMany).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /orders/:orderId/documents/:docId/send — send (team-only)', () => {
  it('a client cannot send (403)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/send`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.updateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('double-send is rejected (409) without a second notification', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.document.updateMany.mockResolvedValue({ count: 0 }) // already sent → lost the claim
    db.document.findFirst.mockResolvedValue({ id: 'doc-1' }) // but it exists
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/send`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    expect(db.outboxEvent.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('sending an unknown doc is 404', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.document.updateMany.mockResolvedValue({ count: 0 })
    db.document.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/missing/send`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('owner sends: status→sent + a single document.sent outbox event', async () => {
    db.order.findUnique.mockResolvedValue(orderRow())
    db.document.updateMany.mockResolvedValue({ count: 1 })
    db.document.findFirstOrThrow.mockResolvedValue({
      id: 'doc-1',
      type: 'invoice',
      number: 'INV-2026-000001',
      status: 'sent',
      generatedAt: new Date('2026-06-01T00:00:00Z'),
      sentAt: new Date('2026-06-02T00:00:00Z'),
      order: { totalAmount: 1000, currency: 'UAH' },
    })
    db.paymentSettings.findUnique.mockResolvedValue({ paymentTermsDays: 7 })
    db.outboxEvent.create.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/send`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.document.status).toBe('sent')
    expect(db.document.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', orderId: ORDER, status: { not: 'sent' } },
        data: expect.objectContaining({ status: 'sent' }),
      })
    )
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1)
    const ev = db.outboxEvent.create.mock.calls[0]![0] as { data: { type: string } }
    expect(ev.data.type).toBe('document.sent')
    await app.close()
  })
})
