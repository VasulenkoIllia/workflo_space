import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 06-ПІДПИС: прийняття документів клієнтом (клік + ПІБ) + договір-гейт + тумблер.
const db = {
  document: { findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  agency: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  agencyMember: { findMany: vi.fn() },
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
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}))

const { buildApp } = await import('../src/app.js')

const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client',
  activeAgencyId: null,
  activeCompanyId: 'company-1',
  agencyMemberships: [],
  memberships: [{ companyId: 'company-1', role: 'owner' }],
}
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' }],
  memberships: [],
}
// LOW-2: рядовий учасник компанії (НЕ власник) — приймати договір не може.
const CLIENT_MEMBER = {
  sub: 'client-2',
  email: 'm@e.com',
  role: 'client',
  activeAgencyId: null,
  activeCompanyId: 'company-1',
  agencyMemberships: [],
  memberships: [{ companyId: 'company-1', role: 'member' }],
}

const CONTRACT_DOC = {
  id: 'doc-1',
  type: 'contract',
  number: 'CTR-2026-000001',
  agencyId: 'agency-1',
  companyId: 'company-1',
  company: { name: 'ТОВ Тест' },
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.document.updateMany.mockResolvedValue({ count: 1 })
  db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }])
  db.agency.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.clearAllMocks())

describe('POST /portal/documents/:docId/accept (06-ПІДПИС)', () => {
  it('client accepts a SENT contract: typed signature fixed, owners notified in-app', async () => {
    db.document.findFirst.mockResolvedValue(CONTRACT_DOC)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/documents/doc-1/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { fullName: 'Іваненко Іван Іванович' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({
      status: 'accepted',
      acceptedByName: 'Іваненко Іван Іванович',
    })
    // Атомарний claim: лише sent → accepted; фіксуємо ПІБ/акаунт/IP
    const upd = db.document.updateMany.mock.calls[0][0]
    expect(upd.where).toEqual({ id: 'doc-1', status: 'sent' })
    expect(upd.data).toMatchObject({
      status: 'accepted',
      acceptedById: 'client-1',
      acceptedByName: 'Іваненко Іван Іванович',
    })
    expect(upd.data.acceptedAt).toBeInstanceOf(Date)
    expect(typeof upd.data.acceptedIp).toBe('string')
    // In-app власнику
    expect(dispatchNotification).toHaveBeenCalledTimes(1)
    expect(dispatchNotification.mock.calls[0][1]).toMatchObject({
      profileId: 'owner-1',
      event: 'documents.accepted',
    })
    await app.close()
  })

  it('LOW-2: рядовий член компанії (не власник) НЕ може прийняти → 403', async () => {
    db.document.findFirst.mockResolvedValue(CONTRACT_DOC)
    const { app, token } = await authed(CLIENT_MEMBER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/documents/doc-1/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { fullName: 'Петренко Петро' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.document.updateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 when the document is not sent yet (or already accepted)', async () => {
    db.document.findFirst.mockResolvedValue(CONTRACT_DOC)
    db.document.updateMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/documents/doc-1/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { fullName: 'Іваненко Іван Іванович' },
    })
    expect(res.statusCode).toBe(409)
    expect(dispatchNotification).not.toHaveBeenCalled()
    await app.close()
  })

  it('403 for a client of another company; 404 for non-acceptable types', async () => {
    db.document.findFirst.mockResolvedValue({ ...CONTRACT_DOC, companyId: 'company-x' })
    const { app, token } = await authed(CLIENT)
    const forbidden = await app.inject({
      method: 'POST',
      url: '/portal/documents/doc-1/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { fullName: 'Іваненко Іван Іванович' },
    })
    expect(forbidden.statusCode).toBe(403)

    // Рахунок не «приймається» — роут шукає лише contract/completion_act → findFirst null
    db.document.findFirst.mockResolvedValue(null)
    const notFound = await app.inject({
      method: 'POST',
      url: '/portal/documents/doc-1/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { fullName: 'Іваненко Іван Іванович' },
    })
    expect(notFound.statusCode).toBe(404)
    const where = db.document.findFirst.mock.calls.at(-1)[0].where
    expect(where.type).toEqual({ in: ['contract', 'completion_act'] })
    await app.close()
  })
})

describe('GET/PATCH /workspace/agency/workflow-settings (договір-гейт тумблер)', () => {
  it('owner toggles requireSignedContract; client is forbidden', async () => {
    db.agency.findUnique.mockResolvedValue({ requireSignedContract: false })
    db.agency.update.mockResolvedValue({ requireSignedContract: true })
    const { app, token } = await authed(OWNER)

    const get = await app.inject({
      method: 'GET',
      url: '/workspace/agency/workflow-settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(get.statusCode).toBe(200)
    expect(get.json().data.requireSignedContract).toBe(false)

    const patch = await app.inject({
      method: 'PATCH',
      url: '/workspace/agency/workflow-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { requireSignedContract: true },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().data.requireSignedContract).toBe(true)

    const ctoken = app.jwt.sign(CLIENT)
    const denied = await app.inject({
      method: 'PATCH',
      url: '/workspace/agency/workflow-settings',
      headers: { authorization: `Bearer ${ctoken}` },
      payload: { requireSignedContract: true },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })
})

describe('POST /workspace/companies/:companyId/contracts/external (06-ДОГОВІР-2)', () => {
  const dbAny = db as unknown as {
    company?: { findFirst: ReturnType<typeof vi.fn> }
    document: { findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> } & {
      create?: ReturnType<typeof vi.fn>
    }
  }

  it('owner registers an external contract (JSON, no file) → accepted immediately', async () => {
    dbAny.company = { findFirst: vi.fn().mockResolvedValue({ id: 'company-1' }) }
    dbAny.document.create = vi.fn().mockResolvedValue({
      id: 'doc-x',
      type: 'contract',
      number: '№ 12/2026',
      status: 'accepted',
      generatedAt: new Date(),
      sentAt: null,
      acceptedAt: new Date('2026-06-01'),
      acceptedByName: 'Петренко П.П.',
      signedExternally: true,
      contractDate: new Date('2026-06-01'),
      externalUrl: 'https://docs.example.com/contract',
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/companies/company-1/contracts/external',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        number: '№ 12/2026',
        contractDate: '2026-06-01',
        signerName: 'Петренко П.П.',
        externalUrl: 'https://docs.example.com/contract',
      },
    })
    expect(res.statusCode).toBe(201)
    const created = dbAny.document.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      type: 'contract',
      number: '№ 12/2026',
      status: 'accepted',
      signedExternally: true,
      acceptedByName: 'Петренко П.П.',
    })
    expect(created.contractDate).toBeInstanceOf(Date)
    await app.close()
  })

  it('409 on duplicate contract number for the company', async () => {
    dbAny.company = { findFirst: vi.fn().mockResolvedValue({ id: 'company-1' }) }
    dbAny.document.create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/companies/company-1/contracts/external',
      headers: { authorization: `Bearer ${token}` },
      payload: { number: '№ 12/2026', contractDate: '2026-06-01', signerName: 'Петренко П.П.' },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('403 for a portal client', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/companies/company-1/contracts/external',
      headers: { authorization: `Bearer ${token}` },
      payload: { number: 'X', contractDate: '2026-06-01', signerName: 'Петренко П.П.' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('GET /portal/documents (06-SEND, зведений список клієнта)', () => {
  it('client gets only SENT/ACCEPTED docs of own companies; company-less → []', async () => {
    db.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        type: 'invoice',
        number: 'INV-1',
        status: 'sent',
        generatedAt: new Date(),
        sentAt: new Date(),
        acceptedAt: null,
        acceptedByName: null,
        signedExternally: false,
        contractDate: null,
        externalUrl: null,
        storedAs: null,
        order: { id: 'o-1', title: 'Лендінг' },
      },
    ])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/documents',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.documents).toHaveLength(1)
    const where = db.document.findMany.mock.calls[0][0].where
    // клієнтський скоуп + чернетки/несформовані не течуть
    expect(where.companyId).toEqual({ in: ['company-1'] })
    expect(where.status).toEqual({ in: ['sent', 'accepted'] })

    // акаунт без компанії → грейсфул порожньо, без запиту
    db.document.findMany.mockClear()
    const noCompany = app.jwt.sign({ ...CLIENT, memberships: [] })
    const empty = await app.inject({
      method: 'GET',
      url: '/portal/documents',
      headers: { authorization: `Bearer ${noCompany}` },
    })
    expect(empty.statusCode).toBe(200)
    expect(empty.json().data.documents).toEqual([])
    expect(db.document.findMany).not.toHaveBeenCalled()
    await app.close()
  })
})
