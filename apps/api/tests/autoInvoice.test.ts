import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// АВТО-РАХУНОК: done → draft-invoice + in-app власнику; guards і hourly-факт.
const db = {
  order: { findUnique: vi.fn(), update: vi.fn() },
  agency: { findUnique: vi.fn() },
  document: { findFirst: vi.fn(), create: vi.fn() },
  agencyMember: { findMany: vi.fn() },
  timeLog: { aggregate: vi.fn() },
  legalEntity: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: (fn: (tx: unknown) => unknown) => fn(db),
}

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workflo/db')>()
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
    runWithSystemContext: (fn: () => unknown) => fn(),
  }
})
const notifyMock = vi.fn().mockResolvedValue({ results: [], attempted: [] })
vi.mock('@workflo/notifications', () => ({ notify: notifyMock }))
vi.mock('../src/services/notifications.js', () => ({
  buildNotifyDeps: () => ({}),
  dispatchNotification: vi.fn(),
}))

const { Prisma } = await import('@workflo/db')
const { maybeAutoInvoiceOnDone } = await import('../src/services/autoInvoice.js')

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const dec = (n: number) => new Prisma.Decimal(n)

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'ord-1',
    agencyId: 'agency-1',
    companyId: 'co-1',
    projectId: null,
    title: 'Лендінг',
    billingType: 'fixed',
    fixedPrice: dec(500),
    approvedAmount: null,
    totalAmount: null,
    hourlyRate: null,
    internalStatus: 'done',
    deletedAt: null,
    project: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.order.findUnique.mockResolvedValue(order())
  db.order.update.mockResolvedValue({})
  db.agency.findUnique.mockResolvedValue({ autoInvoiceOneTime: true })
  db.document.findFirst.mockResolvedValue(null)
  db.document.create.mockResolvedValue({ id: 'doc-1', number: 'INV-2026-000042' })
  db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }])
  db.legalEntity.findFirst.mockResolvedValue(null)
  db.$queryRaw.mockResolvedValue([{ count: 42 }])
  db.timeLog.aggregate.mockResolvedValue({ _sum: { hours: null } })
  notifyMock.mockResolvedValue({ results: [], attempted: [] })
})
afterEach(() => vi.clearAllMocks())

describe('maybeAutoInvoiceOnDone', () => {
  it('fixed order → draft invoice (approvedAmount has precedence) + owner in-app', async () => {
    db.order.findUnique.mockResolvedValue(order({ approvedAmount: dec(450) }))
    const res = await maybeAutoInvoiceOnDone(logger, 'ord-1', 'actor-1')
    expect(res).toBe('created')
    expect(db.document.create).toHaveBeenCalledOnce()
    const data = db.document.create.mock.calls[0][0].data
    expect(data.type).toBe('invoice')
    expect(data.status).toBe('draft')
    expect(data.createdBy.connect.id).toBe('actor-1')
    // totalAmount доштамповано погодженою сумою
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: { totalAmount: dec(450) },
    })
    const call = notifyMock.mock.calls[0][1]
    expect(call.event).toBe('billing.invoice_draft_ready')
    expect(call.profileId).toBe('owner-1')
    expect(call.inApp.body).toContain('INV-2026-000042')
    expect(call.inApp.body).toContain('450.00')
  })

  it('hourly order bills actual TimeLog hours × rate; zero hours → no_amount notice', async () => {
    db.order.findUnique.mockResolvedValue(
      order({ billingType: 'hourly', fixedPrice: null, hourlyRate: dec(40) })
    )
    db.timeLog.aggregate.mockResolvedValue({ _sum: { hours: dec(6.5) } })
    const res = await maybeAutoInvoiceOnDone(logger, 'ord-1', 'actor-1')
    expect(res).toBe('created')
    expect(notifyMock.mock.calls[0][1].inApp.body).toContain('260.00')

    vi.clearAllMocks()
    db.order.findUnique.mockResolvedValue(
      order({ billingType: 'hourly', fixedPrice: null, hourlyRate: dec(40) })
    )
    db.agency.findUnique.mockResolvedValue({ autoInvoiceOneTime: true })
    db.document.findFirst.mockResolvedValue(null)
    db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }])
    db.timeLog.aggregate.mockResolvedValue({ _sum: { hours: null } })
    const res2 = await maybeAutoInvoiceOnDone(logger, 'ord-1', 'actor-1')
    expect(res2).toBe('no_amount')
    expect(db.document.create).not.toHaveBeenCalled()
    expect(notifyMock.mock.calls[0][1].inApp.title).toBe('Авто-рахунок не створено')
  })

  it('skips: toggle off / project order / existing invoice / not done', async () => {
    db.agency.findUnique.mockResolvedValue({ autoInvoiceOneTime: false })
    expect(await maybeAutoInvoiceOnDone(logger, 'ord-1', 'a')).toBe('skipped')

    db.agency.findUnique.mockResolvedValue({ autoInvoiceOneTime: true })
    db.order.findUnique.mockResolvedValue(order({ projectId: 'proj-1' }))
    expect(await maybeAutoInvoiceOnDone(logger, 'ord-1', 'a')).toBe('skipped')

    db.order.findUnique.mockResolvedValue(order())
    db.document.findFirst.mockResolvedValue({ id: 'existing' })
    expect(await maybeAutoInvoiceOnDone(logger, 'ord-1', 'a')).toBe('skipped')

    db.document.findFirst.mockResolvedValue(null)
    db.order.findUnique.mockResolvedValue(order({ internalStatus: 'in_progress' }))
    expect(await maybeAutoInvoiceOnDone(logger, 'ord-1', 'a')).toBe('skipped')

    expect(db.document.create).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })
})
