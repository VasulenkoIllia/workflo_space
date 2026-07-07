import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 05-Б дунінг: overdue-маркування + ланцюжок кроків + ескалація + owner-роути.
const db = {
  serviceCharge: { updateMany: vi.fn(), findMany: vi.fn() },
  dunningLog: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  agency: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  agencyMember: { findFirst: vi.fn(), findMany: vi.fn() },
  companyMember: { findFirst: vi.fn(), findMany: vi.fn() },
  company: { updateMany: vi.fn() },
  emailTemplate: { findMany: vi.fn() },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    DbNull: Symbol('DbNull'),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  runWithSystemContext: (fn: () => unknown) => fn(),
}))
const notifyMock = vi.fn().mockResolvedValue({ results: [], attempted: [] })
vi.mock('@workflo/notifications', () => ({ notify: notifyMock }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
vi.mock('../src/services/notifications.js', () => ({
  buildNotifyDeps: () => ({}),
  dispatchNotification: vi.fn(),
}))
vi.mock('../src/services/emailTemplates.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/emailTemplates.js')>()
  return { ...actual, resolveEmailOverrides: vi.fn().mockResolvedValue(undefined) }
})

const { buildApp } = await import('../src/app.js')
const { runDunningOnce, parseDunningSteps, DEFAULT_DUNNING_STEPS } =
  await import('../src/cron/dunning.js')

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const NOW = new Date('2026-07-07T09:00:00Z')
const dec = (n: number) => ({
  toFixed: (d: number) => n.toFixed(d),
  greaterThan: () => n > 0,
  lessThan: () => n < 0,
})

function charge(over: Record<string, unknown> = {}) {
  return {
    id: 'ch-1',
    agencyId: 'agency-1',
    companyId: 'co-1',
    dueDate: new Date('2026-07-04T00:00:00Z'), // 3 дні тому → крок +3
    amount: dec(500),
    totalAmount: dec(450),
    currency: 'USD',
    periodStart: null,
    periodEnd: null,
    company: { name: 'Acme' },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.serviceCharge.updateMany.mockResolvedValue({ count: 0 })
  db.serviceCharge.findMany.mockResolvedValue([])
  db.dunningLog.findUnique.mockResolvedValue(null)
  db.dunningLog.create.mockResolvedValue({ id: 'log-1' })
  db.dunningLog.update.mockResolvedValue({})
  db.agency.findMany.mockResolvedValue([{ id: 'agency-1', dunningSteps: null }])
  db.agencyMember.findMany.mockResolvedValue([{ agencyId: 'agency-1', profileId: 'owner-1' }])
  db.companyMember.findMany.mockResolvedValue([{ profileId: 'client-1' }])
  db.twoFactorAuth.findUnique.mockResolvedValue(null)
  notifyMock.mockResolvedValue({ results: [], attempted: [] })
})
afterEach(() => vi.clearAllMocks())

describe('parseDunningSteps (05-Б)', () => {
  it('null → default chain; [] → off; sorts, dedupes, clamps range', () => {
    expect(parseDunningSteps(null)).toEqual(DEFAULT_DUNNING_STEPS)
    expect(parseDunningSteps([])).toEqual([])
    expect(parseDunningSteps([7, -3, 7, 0, 99, -50, 2.5, 'x'])).toEqual([-3, 0, 7])
  })
})

describe('runDunningOnce (05-Б)', () => {
  it('marks stale pending/partial as overdue (B-D1) regardless of opt-out', async () => {
    db.serviceCharge.updateMany.mockResolvedValue({ count: 2 })
    const res = await runDunningOnce(logger, NOW)
    expect(res.markedOverdue).toBe(2)
    const where = db.serviceCharge.updateMany.mock.calls[0][0].where
    expect(where.status.in).toEqual(['pending', 'partial'])
    expect(where.dueDate.lt).toEqual(NOW)
    // opt-out НЕ фільтрує маркування — лише листи
    expect(where.company).toBeUndefined()
  })

  it('sends the latest arrived step once per charge (idempotent via DunningLog)', async () => {
    db.serviceCharge.findMany.mockResolvedValue([charge()])
    const res = await runDunningOnce(logger, NOW)
    expect(res.remindersSent).toBe(1)
    // крок +3 (dueDate 3 дні тому), не -3/0
    expect(db.dunningLog.create).toHaveBeenCalledWith({
      data: { agencyId: 'agency-1', chargeId: 'ch-1', stepOffset: 3 },
    })
    const call = notifyMock.mock.calls[0][1]
    expect(call.event).toBe('billing.payment_reminder')
    expect(call.vars.phase).toBe('overdue')
    expect(call.vars.amountDue).toBe('450.00 USD')
    expect(call.vars.daysOverdue).toBe(3)

    // повторний прогін — крок уже в лозі → нічого
    vi.clearAllMocks()
    db.serviceCharge.updateMany.mockResolvedValue({ count: 0 })
    db.serviceCharge.findMany.mockResolvedValue([charge()])
    db.agency.findMany.mockResolvedValue([{ id: 'agency-1', dunningSteps: null }])
    db.agencyMember.findMany.mockResolvedValue([])
    db.dunningLog.findUnique.mockResolvedValue({ id: 'log-1' })
    const res2 = await runDunningOnce(logger, NOW)
    expect(res2.remindersSent).toBe(0)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('upcoming phase before dueDate; custom agency steps respected; [] disables', async () => {
    db.serviceCharge.findMany.mockResolvedValue([
      charge({ dueDate: new Date('2026-07-09T09:00:00Z') }), // за 2 дні → крок -3 настав
    ])
    await runDunningOnce(logger, NOW)
    expect(db.dunningLog.create.mock.calls[0][0].data.stepOffset).toBe(-3)
    expect(notifyMock.mock.calls[0][1].vars.phase).toBe('upcoming')

    vi.clearAllMocks()
    db.serviceCharge.updateMany.mockResolvedValue({ count: 0 })
    db.serviceCharge.findMany.mockResolvedValue([charge()])
    db.agency.findMany.mockResolvedValue([{ id: 'agency-1', dunningSteps: [] }])
    const res = await runDunningOnce(logger, NOW)
    expect(res.remindersSent).toBe(0)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('final step escalates to owners and stamps escalatedAt', async () => {
    db.serviceCharge.findMany.mockResolvedValue([
      charge({ dueDate: new Date('2026-06-20T00:00:00Z') }), // 17 днів тому → крок +14 (останній)
    ])
    const res = await runDunningOnce(logger, NOW)
    expect(res.remindersSent).toBe(1)
    expect(res.escalations).toBe(1)
    const events = notifyMock.mock.calls.map((c) => c[1].event)
    expect(events).toContain('billing.payment_reminder')
    expect(events).toContain('billing.invoice_overdue')
    const esc = notifyMock.mock.calls.find((c) => c[1].event === 'billing.invoice_overdue')![1]
    expect(esc.profileId).toBe('owner-1')
    expect(esc.vars.companyName).toBe('Acme')
    expect(db.dunningLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { escalatedAt: NOW },
    })
  })
})

describe('dunning routes (owner)', () => {
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

  async function authed() {
    const app = buildApp()
    await app.ready()
    return { app, token: app.jwt.sign(OWNER) }
  }

  it('GET returns steps with default flag; PUT saves custom; executor 403', async () => {
    db.agency.findUnique.mockResolvedValue({ dunningSteps: null })
    db.agency.update.mockResolvedValue({ dunningSteps: [0, 7] })
    const { app, token } = await authed()

    const get = await app.inject({
      method: 'GET',
      url: '/workspace/agency/dunning-settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(get.statusCode).toBe(200)
    expect(get.json().data).toMatchObject({ steps: DEFAULT_DUNNING_STEPS, isDefault: true })

    const put = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/dunning-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { steps: [7, 0] },
    })
    expect(put.statusCode).toBe(200)
    expect(put.json().data.steps).toEqual([0, 7])

    const etoken = app.jwt.sign(EXECUTOR)
    const denied = await app.inject({
      method: 'PUT',
      url: '/workspace/agency/dunning-settings',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { steps: [0] },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('PATCH company opt-out scoped to agency; unknown company 404', async () => {
    db.company.updateMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed()
    const ok = await app.inject({
      method: 'PATCH',
      url: '/workspace/companies/co-1/dunning',
      headers: { authorization: `Bearer ${token}` },
      payload: { optOut: true },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.company.updateMany).toHaveBeenCalledWith({
      where: { id: 'co-1', agencyId: 'agency-1' },
      data: { dunningOptOut: true },
    })

    db.company.updateMany.mockResolvedValue({ count: 0 })
    const missing = await app.inject({
      method: 'PATCH',
      url: '/workspace/companies/nope/dunning',
      headers: { authorization: `Bearer ${token}` },
      payload: { optOut: false },
    })
    expect(missing.statusCode).toBe(404)
    await app.close()
  })
})
