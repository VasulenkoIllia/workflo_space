import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// S10-02: SLA-політики + штампування дедлайнів + breach-cron.
const db = {
  slaPolicy: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  order: { findMany: vi.fn(), update: vi.fn() },
  agencyMember: { findMany: vi.fn() },
  agency: { findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  runWithSystemContext: (fn: () => unknown) => fn(),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({ dispatchNotification }))

const { buildApp } = await import('../src/app.js')
const { slaDueDates } = await import('../src/services/sla.js')
const { runSlaCheckOnce } = await import('../src/cron/slaCheck.js')

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
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  role: 'executor' as const,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())

describe('slaDueDates (штампування)', () => {
  it('обчислює обидва дедлайни від політики пріоритету', async () => {
    db.slaPolicy.findFirst.mockResolvedValue({ firstResponseMins: 60, resolutionMins: 480 })
    const now = new Date('2026-07-05T12:00:00Z')
    const sla = await slaDueDates(db as never, AGENCY, 'high', now)
    expect(sla.firstResponseDueAt!.toISOString()).toBe('2026-07-05T13:00:00.000Z')
    expect(sla.resolutionDueAt!.toISOString()).toBe('2026-07-05T20:00:00.000Z')
  })

  it('без політики → null-и (SLA не застосовується)', async () => {
    db.slaPolicy.findFirst.mockResolvedValue(null)
    const sla = await slaDueDates(db as never, AGENCY, 'low')
    expect(sla).toEqual({ firstResponseDueAt: null, resolutionDueAt: null })
  })
})

describe('SLA policies CRUD', () => {
  it('owner upserts a policy; resolution < firstResponse → 400; executor → 403', async () => {
    db.slaPolicy.upsert.mockResolvedValue({
      id: 'sla-1',
      priority: 'high',
      firstResponseMins: 60,
      resolutionMins: 480,
    })
    const { app, token } = await authed(OWNER)
    const ok = await app.inject({
      method: 'PUT',
      url: '/workspace/sla-policies',
      headers: { authorization: `Bearer ${token}` },
      payload: { priority: 'high', firstResponseMins: 60, resolutionMins: 480 },
    })
    expect(ok.statusCode).toBe(200)

    const bad = await app.inject({
      method: 'PUT',
      url: '/workspace/sla-policies',
      headers: { authorization: `Bearer ${token}` },
      payload: { priority: 'high', firstResponseMins: 480, resolutionMins: 60 },
    })
    expect(bad.statusCode).toBe(400)

    const etoken = app.jwt.sign(EXECUTOR as object)
    const denied = await app.inject({
      method: 'PUT',
      url: '/workspace/sla-policies',
      headers: { authorization: `Bearer ${etoken}` },
      payload: { priority: 'high', firstResponseMins: 60, resolutionMins: 480 },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })
})

describe('runSlaCheckOnce (breach-cron)', () => {
  it('прострочена перша відповідь → breach + ескалація власникам, один раз', async () => {
    const now = new Date('2026-07-05T12:00:00Z')
    db.order.findMany.mockResolvedValue([
      {
        id: 'o-1',
        agencyId: AGENCY,
        title: 'Мовчимо клієнту',
        firstRespondedAt: null,
        firstResponseDueAt: new Date('2026-07-05T11:00:00Z'),
        resolutionDueAt: null,
      },
    ])
    db.agencyMember.findMany.mockResolvedValue([{ agencyId: AGENCY, profileId: 'owner-1' }])
    const n = await runSlaCheckOnce(logger, now)
    expect(n).toBe(1)
    const call = dispatchNotification.mock.calls[0]![1] as {
      event: string
      inApp: { title: string; body: string }
    }
    expect(call.event).toBe('orders.sla_breached')
    expect(call.inApp.body).toContain('першої відповіді')
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'o-1' },
      data: { slaBreachedAt: now },
    })
    // where виключає вже-breached і done/cancelled
    const where = (db.order.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where
    expect(where.slaBreachedAt).toBeNull()
    expect(where.internalStatus).toEqual({ notIn: ['done', 'cancelled'] })
  })

  it('нічого простроченого → 0 без нотифікацій', async () => {
    db.order.findMany.mockResolvedValue([])
    const n = await runSlaCheckOnce(logger)
    expect(n).toBe(0)
    expect(dispatchNotification).not.toHaveBeenCalled()
  })
})
