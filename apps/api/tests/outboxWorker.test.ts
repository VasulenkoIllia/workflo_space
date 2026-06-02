import { afterEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const companyMemberFindMany = vi.fn()
const notify = vi.fn().mockResolvedValue({ results: [], attempted: [] })

vi.mock('@workflo/db', () => ({
  prisma: {
    order: { findUnique: orderFindUnique },
    companyMember: { findMany: companyMemberFindMany },
    notificationSettings: { findUnique: vi.fn() },
    notificationPreference: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('@workflo/notifications', () => ({ notify }))

const { buildDispatch } = await import('../src/services/outboxWorker.js')

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Parameters<typeof buildDispatch>[0]

const handler = buildDispatch(logger)
const event = (payload: unknown, type = 'order.status_changed') => ({
  id: 'ev-1',
  type,
  payload,
  agencyId: 'agency-1',
})

describe('outbox worker — order.status_changed handler', () => {
  afterEach(() => vi.clearAllMocks())

  it('notifies non-actor company members when the client status changes', async () => {
    orderFindUnique.mockResolvedValue({
      agencyId: 'agency-1',
      title: 'Land migration',
      companyId: 'company-1',
    })
    companyMemberFindMany.mockResolvedValue([{ profileId: 'p1' }, { profileId: 'p2' }])
    // in_progress (internal) → review (internal) maps to a NEW client status (pending_approval)
    await handler(event({ orderId: 'o1', from: 'in_progress', to: 'review', actorId: 'exec-1' }))
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[0][1].event).toBe('orders.status_changed')
    expect(notify.mock.calls[0][1].vars.newClientStatus).toBe('pending_approval')
    // actor excluded from recipients query
    expect(companyMemberFindMany.mock.calls[0][0].where.profileId).toEqual({ not: 'exec-1' })
  })

  it('stays silent when the change is internal-only (same client status)', async () => {
    // new + clarification both map to client `in_progress` → no client-visible change
    await handler(event({ orderId: 'o1', from: 'new', to: 'clarification', actorId: 'exec-1' }))
    expect(orderFindUnique).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('no-ops when the order has no company members', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'X', companyId: 'company-1' })
    companyMemberFindMany.mockResolvedValue([])
    await handler(event({ orderId: 'o1', from: 'in_progress', to: 'done', actorId: 'exec-1' }))
    expect(notify).not.toHaveBeenCalled()
  })

  it('skips notify when the order belongs to a different tenant than the event (defense-in-depth)', async () => {
    orderFindUnique.mockResolvedValue({
      agencyId: 'agency-OTHER',
      title: 'X',
      companyId: 'company-1',
    })
    companyMemberFindMany.mockResolvedValue([{ profileId: 'p1' }])
    await handler(event({ orderId: 'o1', from: 'in_progress', to: 'review', actorId: 'exec-1' }))
    expect(notify).not.toHaveBeenCalled()
  })

  it('throws on an unknown event type (→ retried → DLQ, never silently dropped)', async () => {
    await expect(handler(event({}, 'unknown.type'))).rejects.toThrow(/no handler/)
  })
})
