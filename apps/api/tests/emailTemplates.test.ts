import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 08-EMAIL: owner-override теми/вступу бізнес-листів (uk/en) + резолв override за профілем.
const db = {
  emailTemplate: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  agencyMember: { findFirst: vi.fn() },
  companyMember: { findFirst: vi.fn() },
  agency: { findMany: vi.fn().mockResolvedValue([]) },
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
vi.mock('@workflo/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workflo/notifications')>()
  return { ...actual, notify: vi.fn() }
})
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { applyEmailOverride } = await import('@workflo/notifications')
const { EDITABLE_EMAIL_EVENTS, resolveEmailOverrides } =
  await import('../src/services/emailTemplates.js')

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
  db.emailTemplate.findMany.mockResolvedValue([])
  db.emailTemplate.deleteMany.mockResolvedValue({ count: 1 })
  db.agencyMember.findFirst.mockResolvedValue(null)
  db.companyMember.findFirst.mockResolvedValue(null)
  db.agency.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.clearAllMocks())

describe('applyEmailOverride (08-EMAIL)', () => {
  const tpl = {
    subject: 'Системна тема',
    html:
      '<h2>Заголовок</h2>' +
      '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Системний вступ.</p>' +
      '<p style="margin:0 0 16px;">Другий абзац лишається.</p>',
  }
  const vars = { invoiceNumber: 'INV-2026-000005', amount: '500,00 USD' }

  it('substitutes {{vars}} in subject, keeps unknown tokens visible', () => {
    const out = applyEmailOverride(
      tpl,
      { subject: 'Рахунок {{invoiceNumber}} на {{amount}} ({{nope}})' },
      vars
    )
    expect(out.subject).toBe('Рахунок INV-2026-000005 на 500,00 USD ({{nope}})')
    expect(out.html).toBe(tpl.html)
  })

  it('intro replaces only the FIRST lead paragraph and escapes html', () => {
    const out = applyEmailOverride(tpl, { intro: 'Вітаємо <b>{{invoiceNumber}}</b>!' }, vars)
    expect(out.html).toContain('Вітаємо &lt;b&gt;INV-2026-000005&lt;/b&gt;!')
    expect(out.html).not.toContain('Системний вступ.')
    expect(out.html).toContain('Другий абзац лишається.')
  })

  it('no override / empty fields → template untouched', () => {
    expect(applyEmailOverride(tpl, undefined, vars)).toEqual(tpl)
    expect(applyEmailOverride(tpl, { subject: null, intro: null }, vars)).toEqual(tpl)
  })
})

describe('resolveEmailOverrides (08-EMAIL)', () => {
  it('internal member → agency templates keyed by locale', async () => {
    db.agencyMember.findFirst.mockResolvedValue({ agencyId: 'agency-1' })
    db.emailTemplate.findMany.mockResolvedValue([
      { locale: 'uk', subject: 'Тема', intro: null },
      { locale: 'en', subject: null, intro: 'Hello' },
    ])
    const out = await resolveEmailOverrides('p-1', 'billing.invoice_sent')
    expect(out).toEqual({
      uk: { subject: 'Тема', intro: null },
      en: { subject: null, intro: 'Hello' },
    })
  })

  it('client resolves agency through company; no rows → undefined', async () => {
    db.companyMember.findFirst.mockResolvedValue({ company: { agencyId: 'agency-1' } })
    const out = await resolveEmailOverrides('client-1', 'chat.new_comment')
    expect(out).toBeUndefined()
    expect(db.emailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId: 'agency-1', event: 'chat.new_comment' } })
    )
  })

  it('non-editable (auth) event → undefined without db lookups', async () => {
    const out = await resolveEmailOverrides('p-1', 'auth.password_reset')
    expect(out).toBeUndefined()
    expect(db.agencyMember.findFirst).not.toHaveBeenCalled()
  })
})

describe('email-templates routes (owner)', () => {
  it('GET returns editable events with vars + saved overrides', async () => {
    db.emailTemplate.findMany.mockResolvedValue([
      {
        event: 'billing.invoice_sent',
        locale: 'uk',
        subject: 'Т',
        intro: null,
        updatedAt: new Date(),
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/agency/email-templates',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.events).toEqual(EDITABLE_EMAIL_EVENTS)
    expect(data.events.some((e: { event: string }) => e.event.startsWith('auth.'))).toBe(false)
    expect(data.templates).toHaveLength(1)
    await app.close()
  })

  it('PUT upserts non-empty locales and deletes emptied ones; unknown event 400; executor 403', async () => {
    db.emailTemplate.upsert.mockResolvedValue({})
    const { app, token } = await authed(OWNER)

    const ok = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/email-templates/billing.invoice_sent',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        uk: { subject: 'Рахунок {{invoiceNumber}}', intro: '' },
        en: { subject: '', intro: '' },
      },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.emailTemplate.upsert).toHaveBeenCalledTimes(1)
    expect(db.emailTemplate.upsert.mock.calls[0][0].create).toMatchObject({
      agencyId: 'agency-1',
      event: 'billing.invoice_sent',
      locale: 'uk',
      subject: 'Рахунок {{invoiceNumber}}',
      intro: null,
    })
    // en порожня → deleteMany саме для en
    expect(db.emailTemplate.deleteMany).toHaveBeenCalledWith({
      where: { agencyId: 'agency-1', event: 'billing.invoice_sent', locale: 'en' },
    })

    const bad = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/email-templates/auth.password_reset',
      headers: { authorization: `Bearer ${token}` },
      payload: { uk: { subject: 'x' } },
    })
    expect(bad.statusCode).toBe(400)

    const etoken = app.jwt.sign(EXECUTOR)
    const denied = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/email-templates/billing.invoice_sent',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { uk: { subject: 'x' } },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('DELETE resets event to system text', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/agency/email-templates/chat.new_comment',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.emailTemplate.deleteMany).toHaveBeenCalledWith({
      where: { agencyId: 'agency-1', event: 'chat.new_comment' },
    })
    await app.close()
  })
})
