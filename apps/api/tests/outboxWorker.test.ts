import { afterEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const companyMemberFindMany = vi.fn()
const agencyMemberFindMany = vi.fn()
const profileFindUnique = vi.fn()
const notify = vi.fn().mockResolvedValue({ results: [], attempted: [] })

const db = {
  order: { findUnique: orderFindUnique },
  // 18-Б mute-фільтр воркера — за замовчуванням ніхто не заглушений
  conversationState: { findMany: vi.fn().mockResolvedValue([]) },
  companyMember: { findMany: companyMemberFindMany },
  agencyMember: { findMany: agencyMemberFindMany },
  profile: { findUnique: profileFindUnique },
  notificationSettings: { findUnique: vi.fn() },
  notificationPreference: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  // R3: аудиторії (recipients.ts) ходять через withTenant — роутимо в той самий дабл
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
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

describe('outbox worker — approval + charge handlers (S6.2)', () => {
  afterEach(() => vi.clearAllMocks())

  it('order.approval_requested → notifies the client company members', async () => {
    orderFindUnique.mockResolvedValue({
      agencyId: 'agency-1',
      title: 'Лендінг',
      companyId: 'company-1',
    })
    companyMemberFindMany.mockResolvedValue([{ profileId: 'c1' }])
    await handler(event({ orderId: 'o1', actorId: 'owner-1' }, 'order.approval_requested'))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][1].inApp.title).toMatch(/погодження/i)
    expect(companyMemberFindMany.mock.calls[0][0].where.profileId).toEqual({ not: 'owner-1' })
  })

  it('order.approval_approved → notifies agency owners/managers (the team)', async () => {
    orderFindUnique.mockResolvedValue({
      agencyId: 'agency-1',
      title: 'Лендінг',
      companyId: 'company-1',
    })
    agencyMemberFindMany.mockResolvedValue([{ profileId: 's1' }])
    await handler(event({ orderId: 'o1', actorId: 'client-1' }, 'order.approval_approved'))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][1].inApp.title).toMatch(/погоджено/i)
    expect(agencyMemberFindMany.mock.calls[0][0].where.role).toEqual({ in: ['owner', 'manager'] })
  })

  it('charge.approval_* → ack without notifying (left outbox, no DLQ)', async () => {
    await handler(event({ chargeId: 'ch-1', actorId: 'owner-1' }, 'charge.approval_approved'))
    expect(notify).not.toHaveBeenCalled()
    expect(orderFindUnique).not.toHaveBeenCalled()
  })
})

describe('outbox worker — S6 event handlers (created / assigned / comment)', () => {
  afterEach(() => vi.clearAllMocks())

  it('order.created → notifies agency staff, minus the actor', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'New job', companyId: 'c1' })
    agencyMemberFindMany.mockResolvedValue([{ profileId: 'm1' }, { profileId: 'm2' }])
    await handler(event({ orderId: 'o1', actorId: 'actor-1' }, 'order.created'))
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[0][1].event).toBe('orders.created')
    expect(agencyMemberFindMany.mock.calls[0][0].where.profileId).toEqual({ not: 'actor-1' })
  })

  it('order.assigned → notifies the assigned executor only', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'Job', companyId: 'c1' })
    await handler(
      event({ orderId: 'o1', executorId: 'exec-9', actorId: 'mgr-1' }, 'order.assigned')
    )
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][1].profileId).toBe('exec-9')
    expect(notify.mock.calls[0][1].event).toBe('orders.assigned')
  })

  it('order.assigned → silent when the actor assigned themselves', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'Job', companyId: 'c1' })
    await handler(event({ orderId: 'o1', executorId: 'me', actorId: 'me' }, 'order.assigned'))
    expect(notify).not.toHaveBeenCalled()
  })

  it('order.comment_created (public) → team + client, with resolved author name', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'Job', companyId: 'c1' })
    profileFindUnique.mockResolvedValue({ name: 'Олена' })
    agencyMemberFindMany.mockResolvedValue([{ profileId: 'm1' }])
    companyMemberFindMany.mockResolvedValue([{ profileId: 'cl1' }])
    await handler(
      event(
        { orderId: 'o1', authorId: 'a1', isInternal: false, preview: 'готово' },
        'order.comment_created'
      )
    )
    expect(notify).toHaveBeenCalledTimes(2) // m1 (team) + cl1 (client)
    expect(notify.mock.calls[0][1].event).toBe('chat.new_comment')
    expect(notify.mock.calls[0][1].vars.authorName).toBe('Олена')
  })

  it('document.sent (invoice) → billing.invoice_sent to the client with invoice vars', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'Job', companyId: 'c1' })
    companyMemberFindMany.mockResolvedValue([{ profileId: 'cl1' }])
    await handler(
      event(
        {
          orderId: 'o1',
          docId: 'doc-1',
          docType: 'invoice',
          number: 'INV-2026-000001',
          amount: '500,00 UAH',
          dueDate: '01.07.2026',
          actorId: 'owner-1',
        },
        'document.sent'
      )
    )
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][1].event).toBe('billing.invoice_sent')
    expect(notify.mock.calls[0][1].vars.invoiceNumber).toBe('INV-2026-000001')
  })

  it('document.sent (act) → documents event (in_app), not the invoice email', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'Job', companyId: 'c1' })
    companyMemberFindMany.mockResolvedValue([{ profileId: 'cl1' }])
    await handler(
      event(
        {
          orderId: 'o1',
          docId: 'doc-2',
          docType: 'completion_act',
          number: 'ACT-2026-000001',
          amount: '500,00 UAH',
          dueDate: '01.07.2026',
          actorId: 'owner-1',
        },
        'document.sent'
      )
    )
    expect(notify.mock.calls[0][1].event).toBe('documents.completion_act_ready')
  })

  it('order.comment_created (internal) → team only, never fans out to the client', async () => {
    orderFindUnique.mockResolvedValue({ agencyId: 'agency-1', title: 'Job', companyId: 'c1' })
    profileFindUnique.mockResolvedValue({ name: 'Команда' })
    agencyMemberFindMany.mockResolvedValue([{ profileId: 'm1' }])
    await handler(
      event(
        { orderId: 'o1', authorId: 'a1', isInternal: true, preview: 'нотатка' },
        'order.comment_created'
      )
    )
    expect(companyMemberFindMany).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
