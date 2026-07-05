import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ─── Mock @workflo/db ────────────────────────────────────────────────────────
const agencyFindMany = vi.fn()
const agencyUpdate = vi.fn()
const agencyMemberFindMany = vi.fn()
const orderFindMany = vi.fn()
const orderCount = vi.fn()
const activityLogFindMany = vi.fn()
const leadFindMany = vi.fn()
const timeLogAggregate = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    agency: { findMany: agencyFindMany, update: agencyUpdate },
    agencyMember: { findMany: agencyMemberFindMany },
    order: { findMany: orderFindMany, count: orderCount },
    activityLog: { findMany: activityLogFindMany },
    lead: { findMany: leadFindMany },
    timeLog: { aggregate: timeLogAggregate },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  runWithSystemContext: (fn: () => unknown) => fn(),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}))

const { runMonthlyReportOnce } = await import('../src/cron/monthlyReport.js')

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const NOW = new Date('2026-07-05T10:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  agencyUpdate.mockResolvedValue({})
  orderFindMany.mockResolvedValue([])
  orderCount.mockResolvedValue(0)
  activityLogFindMany.mockResolvedValue([])
  leadFindMany.mockResolvedValue([])
  timeLogAggregate.mockResolvedValue({ _sum: { hours: null } })
  agencyMemberFindMany.mockResolvedValue([{ profileId: 'owner-1' }])
})

describe('runMonthlyReportOnce (S11)', () => {
  it('does nothing when no agency has the toggle on', async () => {
    agencyFindMany.mockResolvedValue([])
    const sent = await runMonthlyReportOnce(logger, NOW)
    expect(sent).toBe(0)
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('queries only agencies not yet reported this month (lastSentAt gate)', async () => {
    agencyFindMany.mockResolvedValue([])
    await runMonthlyReportOnce(logger, NOW)
    const where = agencyFindMany.mock.calls[0][0].where
    expect(where.monthlyReportEnabled).toBe(true)
    // гейт: null АБО < початку ПОТОЧНОГО місяця (2026-07-01)
    expect(where.OR[1].monthlyReportLastSentAt.lt.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('dispatches the digest for the PREVIOUS month to every owner and stamps lastSentAt', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'ag-1', name: 'Test Agency' }])
    agencyMemberFindMany.mockResolvedValue([{ profileId: 'owner-1' }, { profileId: 'owner-2' }])
    orderCount.mockResolvedValue(7)

    const sent = await runMonthlyReportOnce(logger, NOW)
    expect(sent).toBe(1)

    // Вікно дайджесту — червень 2026
    const countWhere = orderCount.mock.calls[0][0].where
    expect(countWhere.createdAt.gte.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(countWhere.createdAt.lt.toISOString()).toBe('2026-07-01T00:00:00.000Z')

    // Обом власникам, з рядками дайджесту
    expect(dispatchNotification).toHaveBeenCalledTimes(2)
    const [, payload] = dispatchNotification.mock.calls[0]
    expect(payload.event).toBe('reports.monthly')
    expect(payload.vars.periodLabel).toContain('2026')
    const labels = payload.vars.rows.map((r: [string, string]) => r[0])
    expect(labels).toContain('Нових замовлень')
    expect(labels).toContain('SLA: перша відповідь')
    expect(payload.vars.rows.find((r: [string, string]) => r[0] === 'Нових замовлень')[1]).toBe('7')

    expect(agencyUpdate).toHaveBeenCalledWith({
      where: { id: 'ag-1' },
      data: { monthlyReportLastSentAt: NOW },
    })
  })
})
