import { describe, expect, it, vi } from 'vitest'
import { computeSlaReport } from '../src/services/slaReport.js'

/**
 * Pure-service тест SLA-звіту (S11): buckets met/late/pending для першої відповіді
 * і розвʼязання, doneAt із ActivityLog, розріз по виконавцях, список порушень.
 */
const NOW = new Date('2026-07-05T12:00:00Z')
const H = 3_600_000

interface FakeOrder {
  id: string
  title: string
  assigneeId: string | null
  assignee: { name: string } | null
  internalStatus: string
  firstResponseDueAt: Date | null
  firstRespondedAt: Date | null
  resolutionDueAt: Date | null
  updatedAt: Date
}

function makeDb(orders: FakeOrder[], activities: unknown[] = []) {
  return {
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    activityLog: { findMany: vi.fn().mockResolvedValue(activities) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const base = (over: Partial<FakeOrder>): FakeOrder => ({
  id: 'o1',
  title: 'Test',
  assigneeId: 'exec-1',
  assignee: { name: 'Петро' },
  internalStatus: 'in_progress',
  firstResponseDueAt: null,
  firstRespondedAt: null,
  resolutionDueAt: null,
  updatedAt: NOW,
  ...over,
})

describe('computeSlaReport', () => {
  it('buckets first-response met / late / pending correctly', async () => {
    const due = new Date(NOW.getTime() - 2 * H)
    const db = makeDb([
      // met: відповіли ДО дедлайну
      base({ id: 'a', firstResponseDueAt: due, firstRespondedAt: new Date(due.getTime() - H) }),
      // late: відповіли ПІСЛЯ дедлайну
      base({ id: 'b', firstResponseDueAt: due, firstRespondedAt: new Date(due.getTime() + H) }),
      // late: не відповіли, дедлайн минув → у breachedOrders
      base({ id: 'c', firstResponseDueAt: due }),
      // pending: не відповіли, дедлайн у майбутньому
      base({ id: 'd', firstResponseDueAt: new Date(NOW.getTime() + H) }),
    ])
    const r = await computeSlaReport(db, {
      agencyId: 'ag-1',
      from: '2026-07-01',
      to: '2026-07-05',
      now: NOW,
    })
    expect(r.firstResponse).toEqual({ met: 1, late: 2, pending: 1, compliancePct: 33.3 })
    expect(r.breachedOrders).toHaveLength(1)
    expect(r.breachedOrders[0]).toMatchObject({ orderId: 'c', kind: 'first_response' })
  })

  it('resolution uses doneAt from the activity timeline, excludes cancelled', async () => {
    const due = new Date(NOW.getTime() - H)
    const db = makeDb(
      [
        // done ДО дедлайну (за activity) → met, попри пізніший updatedAt
        base({ id: 'a', internalStatus: 'done', resolutionDueAt: due, updatedAt: NOW }),
        // done ПІСЛЯ дедлайну (за activity) → late
        base({ id: 'b', internalStatus: 'done', resolutionDueAt: due, updatedAt: NOW }),
        // відкрите з простроченим дедлайном → late + breach
        base({ id: 'c', internalStatus: 'in_progress', resolutionDueAt: due }),
        // скасоване — поза знаменником
        base({ id: 'd', internalStatus: 'cancelled', resolutionDueAt: due }),
      ],
      [
        { orderId: 'a', createdAt: new Date(due.getTime() - H), metadata: { to: 'done' } },
        { orderId: 'b', createdAt: new Date(due.getTime() + H), metadata: { to: 'done' } },
      ]
    )
    const r = await computeSlaReport(db, {
      agencyId: 'ag-1',
      from: '2026-07-01',
      to: '2026-07-05',
      now: NOW,
    })
    expect(r.resolution).toEqual({ met: 1, late: 2, pending: 0, compliancePct: 33.3 })
    expect(r.breachedOrders.map((b) => b.orderId)).toEqual(['c'])
  })

  it('groups by assignee with per-row percentages', async () => {
    const duePast = new Date(NOW.getTime() - H)
    const db = makeDb([
      base({ id: 'a', firstResponseDueAt: duePast, firstRespondedAt: duePast }),
      base({
        id: 'b',
        assigneeId: null,
        assignee: null,
        firstResponseDueAt: duePast,
      }),
    ])
    const r = await computeSlaReport(db, {
      agencyId: 'ag-1',
      from: '2026-07-01',
      to: '2026-07-05',
      now: NOW,
    })
    expect(r.byAssignee).toHaveLength(2)
    const petro = r.byAssignee.find((x) => x.assigneeId === 'exec-1')
    const none = r.byAssignee.find((x) => x.assigneeId === null)
    expect(petro?.firstResponse.compliancePct).toBe(100)
    expect(none?.name).toBe('Без виконавця')
    expect(none?.firstResponse.compliancePct).toBe(0)
  })

  it('returns null percentages when nothing is judged yet', async () => {
    const db = makeDb([base({ id: 'a', firstResponseDueAt: new Date(NOW.getTime() + H) })])
    const r = await computeSlaReport(db, {
      agencyId: 'ag-1',
      from: '2026-07-01',
      to: '2026-07-05',
      now: NOW,
    })
    expect(r.firstResponse.compliancePct).toBeNull()
    expect(r.total).toBe(1)
  })
})
