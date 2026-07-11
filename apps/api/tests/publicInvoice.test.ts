import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 06-Д: публічна сторінка рахунку — видача/відкликання лінка (team) + no-auth читання
// по токену. Той самий db-double патерн, що й documentsRoute.test.ts.
const db = {
  order: { findUnique: vi.fn() },
  document: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  paymentSettings: { findUnique: vi.fn() },
  legalEntity: { findFirst: vi.fn() },
  estimateLine: { findMany: vi.fn() },
  exchangeRate: { findUnique: vi.fn() },
  serviceCharge: { findMany: vi.fn() },
  payment: { findMany: vi.fn() },
  documentTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
  agency: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
    runWithSystemContext: (fn: () => unknown) => fn(),
  }
})

class ChromiumUnavailableError extends Error {}
vi.mock('@workflo/templates', () => ({
  ChromiumUnavailableError,
  renderDocumentHtml: () => '<html lang="en"><body>rendered-doc</body></html>',
  htmlToPdf: vi.fn().mockRejectedValue(new ChromiumUnavailableError()),
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const ORDER = 'order-1'
const TOKEN = 'tok_0123456789abcdef0123456789abcdef'

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
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const orderRow = () => ({ id: ORDER, agencyId: AGENCY, companyId: 'company-1', deletedAt: null })

/** Рядок PUBLIC_DOC_SELECT для no-auth читання (buildRenderData-сумісний). */
const publicDocRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'doc-1',
  type: 'invoice',
  number: 'INV-2026-000001',
  status: 'sent',
  generatedAt: new Date('2026-07-01T00:00:00Z'),
  companyId: 'company-1',
  agencyId: AGENCY,
  agency: { name: 'Workflo' },
  order: {
    id: ORDER,
    title: 'CRM rebuild',
    description: null,
    totalAmount: 9800,
    approvedAmount: null,
    currency: 'EUR',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    project: null,
  },
  company: { name: 'Brunky', legalName: null, taxId: null, legalAddress: null },
  legalEntity: null,
  ...over,
})

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.legalEntity.findFirst.mockResolvedValue(null)
  db.estimateLine.findMany.mockResolvedValue([])
  db.exchangeRate.findUnique.mockResolvedValue(null)
  db.serviceCharge.findMany.mockResolvedValue([])
  db.payment.findMany.mockResolvedValue([])
  db.paymentSettings.findUnique.mockResolvedValue(null)
  db.documentTemplate.findUnique.mockResolvedValue(null)
  db.agency.findUnique.mockResolvedValue(null)
  db.document.findFirst.mockResolvedValue(null)
  db.order.findUnique.mockResolvedValue(orderRow())
})
afterEach(() => vi.clearAllMocks())

describe('POST /orders/:orderId/documents/:docId/public-link (06-Д)', () => {
  it('клієнт не може видати лінк (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/public-link`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('owner видає токен для рахунку; URL містить токен', async () => {
    db.document.findFirst.mockResolvedValue({ id: 'doc-1', type: 'invoice', publicToken: null })
    db.document.update.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/public-link`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const { data } = res.json()
    expect(data.publicToken).toHaveLength(32) // 24 байти base64url
    expect(data.url).toContain(`/public/documents/${data.publicToken}`)
    expect(db.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { publicToken: data.publicToken } })
    )
    await app.close()
  })

  it('ідемпотентно: наявний токен повертається без перезапису', async () => {
    db.document.findFirst.mockResolvedValue({ id: 'doc-1', type: 'invoice', publicToken: TOKEN })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/public-link`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.publicToken).toBe(TOKEN)
    expect(db.document.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('не-рахунок (contract) → 400', async () => {
    db.document.findFirst.mockResolvedValue({ id: 'doc-1', type: 'contract', publicToken: null })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${ORDER}/documents/doc-1/public-link`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(db.document.update).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('GET /public/documents/:token — без логіна', () => {
  it('валідний токен → 200 HTML з тоб-баром і документом', async () => {
    db.document.findUnique.mockResolvedValue(publicDocRow())
    const app = buildApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: `/public/documents/${TOKEN}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('rendered-doc')
    expect(res.body).toContain('INV-2026-000001')
    expect(res.body).toContain(`/public/documents/${TOKEN}/pdf`)
    expect(db.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicToken: TOKEN } })
    )
    await app.close()
  })

  it('невідомий токен → 404; закороткий токен → 404 без запиту в БД', async () => {
    db.document.findUnique.mockResolvedValue(null)
    const app = buildApp()
    await app.ready()
    const miss = await app.inject({ method: 'GET', url: `/public/documents/${TOKEN}` })
    expect(miss.statusCode).toBe(404)
    const short = await app.inject({ method: 'GET', url: '/public/documents/abc' })
    expect(short.statusCode).toBe(404)
    expect(db.document.findUnique).toHaveBeenCalledTimes(1) // короткий не дійшов до БД
    await app.close()
  })

  it('PDF-ендпоінт: без Chromium віддає HTML-фолбек', async () => {
    db.document.findUnique.mockResolvedValue(publicDocRow())
    const app = buildApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: `/public/documents/${TOKEN}/pdf` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-document-format']).toBe('html-fallback')
    await app.close()
  })
})

describe('DELETE /orders/:orderId/documents/:docId/public-link — відкликання', () => {
  it('team знімає токен; повторне зняття → 404', async () => {
    db.document.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    const { app, token } = await authed(OWNER)
    const ok = await app.inject({
      method: 'DELETE',
      url: `/orders/${ORDER}/documents/doc-1/public-link`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.document.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { publicToken: null } })
    )
    const again = await app.inject({
      method: 'DELETE',
      url: `/orders/${ORDER}/documents/doc-1/public-link`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(again.statusCode).toBe(404)
    await app.close()
  })
})
