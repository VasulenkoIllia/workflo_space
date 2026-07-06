import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 06-А: шаблони документів з {{змінними}} + PDF-брендинг (owner-роути + підстановка).
const db = {
  documentTemplate: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  agency: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { substituteVars, varsFromRenderData, applyTemplate } =
  await import('../src/services/documentTemplates.js')

const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' }],
  memberships: [],
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.documentTemplate.findMany.mockResolvedValue([])
  db.documentTemplate.deleteMany.mockResolvedValue({ count: 1 })
  db.agency.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.clearAllMocks())

describe('substituteVars / applyTemplate (06-А)', () => {
  const renderData = {
    typeLabel: 'Договір',
    number: 'CTR-1',
    date: '06.07.2026',
    orderTitle: 'Лендінг',
    amount: '500,00',
    currency: 'USD',
    issuer: { name: 'Workflo', legalName: 'ТОВ Воркфло' },
    recipient: { name: 'Acme', legalName: 'ТОВ Акме' },
    projectName: 'Сайт',
    contractRef: 'Договір № 7 від 01.05.2026',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  it('replaces known tokens, keeps unknown ones visible', () => {
    const vars = varsFromRenderData(renderData)
    expect(substituteVars('Клієнт {{client}} ({{client_legal}}) — {{amount}}', vars)).toBe(
      'Клієнт Acme (ТОВ Акме) — 500,00 USD'
    )
    expect(substituteVars('{{ agency }} і {{unknown_token}}', vars)).toBe(
      'ТОВ Воркфло і {{unknown_token}}'
    )
  })

  it('contract template → substituted sections; note template → customNote; purpose only for invoices', () => {
    const d1 = { ...renderData }
    applyTemplate(d1, 'contract', {
      sections: [{ h: 'Предмет — {{order}}', p: ['{{agency}} для {{client}}'] }],
    })
    expect(d1.contractSections).toEqual([{ h: 'Предмет — Лендінг', p: ['ТОВ Воркфло для Acme'] }])

    const d2 = { ...renderData }
    applyTemplate(d2, 'completion_act', { note: 'Згідно {{contract}}', purpose: 'ігнор' })
    expect(d2.customNote).toBe('Згідно Договір № 7 від 01.05.2026')
    expect(d2.paymentPurpose).toBeUndefined()

    const d3 = { ...renderData }
    applyTemplate(d3, 'invoice', { purpose: 'Оплата {{number}} від {{date}}' })
    expect(d3.paymentPurpose).toBe('Оплата CTR-1 від 06.07.2026')
  })
})

describe('document-templates routes (owner)', () => {
  it('GET returns overrides + variables + tokenized contract default', async () => {
    db.documentTemplate.findMany.mockResolvedValue([
      { type: 'invoice', body: { note: 'x' }, updatedAt: new Date() },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/agency/document-templates',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.templates).toHaveLength(1)
    expect(data.variables.length).toBeGreaterThan(5)
    // типовий договір повернуто з {{токенами}} для префілу редактора
    const flat = JSON.stringify(data.contractDefault)
    expect(flat).toContain('{{order}}')
    expect(data.contractDefault.length).toBeGreaterThan(3)
    await app.close()
  })

  it('PUT validates per type; executor is forbidden', async () => {
    db.documentTemplate.upsert.mockResolvedValue({
      type: 'contract',
      body: { sections: [{ h: 'A', p: ['b'] }] },
      updatedAt: new Date(),
    })
    const { app, token } = await authed(OWNER)
    const ok = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/document-templates/contract',
      headers: { authorization: `Bearer ${token}` },
      payload: { sections: [{ h: 'A', p: ['b'] }] },
    })
    expect(ok.statusCode).toBe(200)

    const badType = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/document-templates/monthly_report',
      headers: { authorization: `Bearer ${token}` },
      payload: { note: 'x' },
    })
    expect(badType.statusCode).toBe(400)

    // порожнє тіло для note-типу → 400 (видаляйте, а не зберігайте порожнє)
    const empty = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/document-templates/invoice',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(empty.statusCode).toBe(400)

    const etoken = app.jwt.sign(EXECUTOR)
    const denied = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/document-templates/contract',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { sections: [{ h: 'A', p: ['b'] }] },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('PDF-branding: accent hex validated; GET reflects state', async () => {
    db.agency.findUnique.mockResolvedValue({ pdfLogoKey: null, pdfAccentColor: null })
    db.agency.update.mockResolvedValue({ pdfLogoKey: null, pdfAccentColor: '#FF6600' })
    const { app, token } = await authed(OWNER)

    const bad = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/pdf-branding',
      headers: { authorization: `Bearer ${token}` },
      payload: { accentColor: 'red' },
    })
    expect(bad.statusCode).toBe(400)

    const ok = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/pdf-branding',
      headers: { authorization: `Bearer ${token}` },
      payload: { accentColor: '#FF6600' },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data.accentColor).toBe('#FF6600')

    const get = await app.inject({
      method: 'GET',
      url: '/workspace/agency/pdf-branding',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(get.statusCode).toBe(200)
    expect(get.json().data.hasLogo).toBe(false)
    await app.close()
  })
})
