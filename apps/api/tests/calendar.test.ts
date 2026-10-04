import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 24 Calendar MVP: зустрічі (CRUD+respond) + агрегований view.
const db = {
  calendarEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  calendarAttendee: { createMany: vi.fn(), updateMany: vi.fn() },
  agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
  companyMember: { findMany: vi.fn().mockResolvedValue([]) },
  order: { findMany: vi.fn().mockResolvedValue([]) },
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
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
vi.mock('../src/services/notifications.js', () => ({
  buildNotifyDeps: () => ({}),
  dispatchNotification: vi.fn(),
}))

const { buildApp } = await import('../src/app.js')
const { dispatchNotification } = await import('../src/services/notifications.js')

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
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client',
  activeAgencyId: 'agency-1',
  activeCompanyId: 'co-1',
  agencyMemberships: [],
  memberships: [{ companyId: 'co-1', role: 'member' }],
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
  db.order.findMany.mockResolvedValue([])
  db.agency.findMany.mockResolvedValue([])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.clearAllMocks())

const T0 = '2026-07-10T10:00:00.000Z'
const T1 = '2026-07-10T11:00:00.000Z'

describe('calendar events (24)', () => {
  it('executor creates a client meeting, invites members, notifies them; client cannot create', async () => {
    db.agencyMember.findMany.mockResolvedValue([
      { profileId: '22222222-2222-4222-8222-222222222222' },
    ])
    db.companyMember.findMany.mockResolvedValue([
      { profileId: '33333333-3333-4333-8333-333333333333' },
    ])
    db.calendarEvent.create.mockResolvedValue({ id: 'ev-1' })
    db.calendarAttendee.createMany.mockResolvedValue({ count: 2 })
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/calendar/events',
      headers: { authorization: `Bearer ${etoken}` },
      payload: {
        title: 'Демо продукту',
        type: 'client_meeting',
        companyId: '11111111-1111-4111-8111-111111111111',
        startsAt: T0,
        endsAt: T1,
        attendeeIds: [
          '22222222-2222-4222-8222-222222222222',
          '33333333-3333-4333-8333-333333333333',
        ],
      },
    })
    expect(res.statusCode).toBe(201)
    expect(db.calendarEvent.create.mock.calls[0][0].data.type).toBe('client_meeting')
    // запрошеним пішли calendar.invited
    const invited = (dispatchNotification as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => c[1] as { event: string })
      .filter((v) => v.event === 'calendar.invited')
    expect(invited.length).toBe(2)

    const ctoken = app.jwt.sign(CLIENT)
    const denied = await app.inject({
      method: 'POST',
      url: '/calendar/events',
      headers: { authorization: `Bearer ${ctoken}` },
      payload: { title: 'x', type: 'internal_meeting', startsAt: T0, endsAt: T1 },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('client_meeting без companyId → 400; endsAt ≤ startsAt → 400', async () => {
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const noCompany = await app.inject({
      method: 'POST',
      url: '/calendar/events',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { title: 'Зустріч', type: 'client_meeting', startsAt: T0, endsAt: T1 },
    })
    expect(noCompany.statusCode).toBe(400)

    const badRange = await app.inject({
      method: 'POST',
      url: '/calendar/events',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { title: 'Зустріч', type: 'internal_meeting', startsAt: T1, endsAt: T0 },
    })
    expect(badRange.statusCode).toBe(400)
    await app.close()
  })

  it('cancel by creator notifies attendees; non-owner non-creator → 403', async () => {
    db.calendarEvent.findFirst.mockResolvedValue({
      id: 'ev-1',
      title: 'Демо',
      startsAt: new Date(T0),
      createdById: 'exec-1',
      cancelledAt: null,
      agencyId: 'agency-1',
      attendees: [{ profileId: 'client-1' }],
    })
    db.calendarEvent.update.mockResolvedValue({})
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/calendar/events/ev-1/cancel',
      headers: { authorization: `Bearer ${etoken}` },
    })
    expect(res.statusCode).toBe(200)
    const cancelled = (
      dispatchNotification as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls
      .map((c) => c[1] as { event: string })
      .filter((v) => v.event === 'calendar.cancelled')
    expect(cancelled.length).toBe(1)

    // інший виконавець (не creator, не owner) → 403
    db.calendarEvent.findFirst.mockResolvedValue({
      id: 'ev-1',
      title: 'Демо',
      startsAt: new Date(T0),
      createdById: 'exec-1',
      cancelledAt: null,
      agencyId: 'agency-1',
      attendees: [],
    })
    const other = app.jwt.sign({ ...EXECUTOR, sub: 'exec-9' })
    const forbidden = await app.inject({
      method: 'POST',
      url: '/calendar/events/ev-1/cancel',
      headers: { authorization: `Bearer ${other}` },
    })
    expect(forbidden.statusCode).toBe(403)
    await app.close()
  })

  it('respond updates the attendee; not invited → 404', async () => {
    db.calendarAttendee.updateMany.mockResolvedValue({ count: 1 })
    const { app } = await authed(CLIENT)
    const ctoken = app.jwt.sign(CLIENT)
    const res = await app.inject({
      method: 'POST',
      url: '/calendar/events/ev-1/respond',
      headers: { authorization: `Bearer ${ctoken}` },
      payload: { response: 'accepted' },
    })
    expect(res.statusCode).toBe(200)
    expect(db.calendarAttendee.updateMany.mock.calls[0][0].data.response).toBe('accepted')

    db.calendarAttendee.updateMany.mockResolvedValue({ count: 0 })
    const notInvited = await app.inject({
      method: 'POST',
      url: '/calendar/events/ev-2/respond',
      headers: { authorization: `Bearer ${ctoken}` },
      payload: { response: 'declined' },
    })
    expect(notInvited.statusCode).toBe(404)
    await app.close()
  })
})

describe('calendar view (24)', () => {
  it('merges meetings + order deadlines, sorted by time', async () => {
    db.calendarEvent.findMany.mockResolvedValue([
      {
        id: 'ev-1',
        title: 'Зустріч',
        type: 'internal_meeting',
        startsAt: new Date(T1),
        company: null,
      },
    ])
    db.order.findMany.mockResolvedValue([
      { id: 'ord-1', title: 'Лендінг', deadline: new Date(T0), company: { name: 'Acme' } },
    ])
    const { app } = await authed(EXECUTOR)
    const etoken = app.jwt.sign(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/calendar/view?from=${T0}&to=${T1}`,
      headers: { authorization: `Bearer ${etoken}` },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().data.items
    expect(items).toHaveLength(2)
    // відсортовано: дедлайн (T0) перед зустріччю (T1)
    expect(items[0].kind).toBe('deadline')
    expect(items[1].kind).toBe('meeting')
    await app.close()
  })
})
