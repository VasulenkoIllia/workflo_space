import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 29 Support MVP: тікети (portal+workspace) + leak-guard + participant-IDOR.
const db = {
  ticket: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  ticketMessage: { create: vi.fn(), findMany: vi.fn() },
  agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
  companyMember: { findMany: vi.fn().mockResolvedValue([]) },
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
  runWithAgency: (_a: string, fn: () => unknown) => fn(),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
vi.mock('../src/services/notifications.js', () => ({
  buildNotifyDeps: () => ({}),
  dispatchNotification: vi.fn(),
}))

const { buildApp } = await import('../src/app.js')

const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client',
  activeAgencyId: 'agency-1',
  activeCompanyId: 'co-1',
  agencyMemberships: [],
  memberships: [{ companyId: 'co-1', role: 'member' }],
}
const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
  memberships: [],
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.agencyMember.findMany.mockResolvedValue([])
  db.companyMember.findMany.mockResolvedValue([])
  db.agency.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
  db.ticketMessage.findMany.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('support portal (29)', () => {
  it('client opens a ticket + first message; team is 403 on portal-open', async () => {
    db.ticket.create.mockResolvedValue({ id: 't-1' })
    db.ticketMessage.create.mockResolvedValue({ id: 'm-1' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/support/tickets',
      headers: { authorization: `Bearer ${token}` },
      payload: { subject: 'Не працює вхід', category: 'problem', message: 'Не можу зайти' },
    })
    expect(res.statusCode).toBe(201)
    expect(db.ticket.create).toHaveBeenCalledOnce()
    expect(db.ticket.create.mock.calls[0][0].data).toMatchObject({
      companyId: 'co-1',
      openedById: 'client-1',
      category: 'problem',
      status: 'open',
      source: 'portal',
    })

    const etoken = app.jwt.sign(EXECUTOR)
    const denied = await app.inject({
      method: 'POST',
      url: '/support/tickets',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { subject: 'x', message: 'y' },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('client thread EXCLUDES internal notes (leak-guard where); IDOR → 404', async () => {
    db.ticket.findUnique.mockResolvedValue({ id: 't-1', agencyId: 'agency-1', companyId: 'co-1' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/support/tickets/t-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    // клієнтський read має нести isInternal: false у where
    const where = db.ticketMessage.findMany.mock.calls[0][0].where
    expect(where.isInternal).toBe(false)

    // IDOR: тікет іншої компанії → 404
    db.ticket.findUnique.mockResolvedValue({
      id: 't-2',
      agencyId: 'agency-1',
      companyId: 'other-co',
    })
    const idor = await app.inject({
      method: 'GET',
      url: '/support/tickets/t-2',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(idor.statusCode).toBe(404)
    await app.close()
  })

  it('team thread INCLUDES internal notes (no isInternal filter)', async () => {
    db.ticket.findUnique.mockResolvedValue({ id: 't-1', agencyId: 'agency-1', companyId: 'co-1' })
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/support/tickets/t-1',
      headers: { authorization: `Bearer ${etoken}` },
    })
    expect(res.statusCode).toBe(200)
    const where = db.ticketMessage.findMany.mock.calls[0][0].where
    expect(where.isInternal).toBeUndefined() // команда бачить усе
    await app.close()
  })
})

describe('support workspace (29)', () => {
  it('team reply flips open→pending + stamps firstResponseAt; client reply flips pending→open', async () => {
    db.ticket.findUnique.mockResolvedValue({ id: 't-1', agencyId: 'agency-1', companyId: 'co-1' })
    db.ticketMessage.create.mockResolvedValue({
      id: 'm-2',
      content: 'Дивимось',
      isInternal: false,
      createdAt: new Date(),
      editedAt: null,
      authorId: 'exec-1',
      author: { id: 'exec-1', name: 'Exec', agencyMemberships: [{ agencyId: 'agency-1' }] },
    })
    db.ticket.findUniqueOrThrow.mockResolvedValue({
      id: 't-1',
      companyId: 'co-1',
      openedById: 'client-1',
      assignedToId: null,
      status: 'open',
      subject: 'Тест',
      firstResponseAt: null,
    })
    db.ticket.update.mockResolvedValue({})
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/support/tickets/t-1/messages',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { content: 'Дивимось' },
    })
    expect(res.statusCode).toBe(201)
    const upd = db.ticket.update.mock.calls[0][0].data
    expect(upd.status).toBe('pending')
    expect(upd.firstResponseAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('PATCH status resolved stamps resolvedAt; executor-only queue; client 403 on queue', async () => {
    db.ticket.findFirst.mockResolvedValue({
      id: 't-1',
      status: 'open',
      companyId: 'co-1',
      subject: 'Тест',
    })
    db.ticket.update.mockResolvedValue({ id: 't-1', status: 'resolved' })
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/tickets/t-1',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { status: 'resolved' },
    })
    expect(res.statusCode).toBe(200)
    expect(db.ticket.update.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date)

    const ctoken = app.jwt.sign(CLIENT)
    const denied = await app.inject({
      method: 'GET',
      url: '/workspace/tickets',
      headers: { authorization: `Bearer ${ctoken}` },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })
})
