import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 02-А (S5.6 P-7) — estimate-approval state machine: team submits, client (owner) decides,
// and the → in_progress transition is gated until approved. Route-level tests over a real app
// with a mocked @workflo/db (mirrors orders.test.ts), so no DB is required.
const orderFindFirst = vi.fn()
const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()
const orderUpdateMany = vi.fn()
const orderFindUniqueOrThrow = vi.fn()
const activityCreate = vi.fn()
const outboxCreate = vi.fn()
const auditLogCreate = vi.fn()

function txImpl(arg: unknown) {
  if (typeof arg === 'function') {
    return (arg as (tx: unknown) => unknown)({
      order: { updateMany: orderUpdateMany, findUniqueOrThrow: orderFindUniqueOrThrow },
      activityLog: { create: activityCreate },
      outboxEvent: { create: outboxCreate },
    })
  }
  return Promise.all(arg as Promise<unknown>[])
}
const transaction = vi.fn(txImpl)

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  const prisma = {
    order: {
      findFirst: orderFindFirst,
      findUnique: orderFindUnique,
      update: orderUpdate,
      updateMany: orderUpdateMany,
      findUniqueOrThrow: orderFindUniqueOrThrow,
    },
    activityLog: { create: activityCreate },
    outboxEvent: { create: outboxCreate },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  }
  return {
    prisma,
    tenantTransaction: (client: { $transaction: (fn: unknown) => unknown }, fn: unknown) =>
      client.$transaction(fn),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
    Prisma: actual.Prisma,
  }
})

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')
// The vi.mock above re-exports the real Prisma, so this resolves to the genuine Decimal.
const { Prisma } = await import('@workflo/db')

const AGENCY = 'agency-1'
const COMPANY = '11111111-1111-4111-8111-111111111111'

const TEAM = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const CLIENT_OWNER = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: COMPANY,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: COMPANY, role: 'owner' as const }],
}
const CLIENT_MEMBER = {
  ...CLIENT_OWNER,
  sub: 'client-2',
  memberships: [{ companyId: COMPANY, role: 'member' as const }],
}
const CLIENT_DELEGATE = {
  ...CLIENT_OWNER,
  sub: 'client-3',
  memberships: [
    { companyId: COMPANY, role: 'member' as const, permissions: { can_approve_estimates: true } },
  ],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}
function post(
  app: Awaited<ReturnType<typeof authed>>['app'],
  token: string,
  url: string,
  body: unknown
) {
  return app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  })
}
function patch(
  app: Awaited<ReturnType<typeof authed>>['app'],
  token: string,
  url: string,
  body: unknown
) {
  return app.inject({
    method: 'PATCH',
    url,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  auditLogCreate.mockResolvedValue({})
  activityCreate.mockResolvedValue({})
  outboxCreate.mockResolvedValue({})
  orderUpdateMany.mockResolvedValue({ count: 1 })
})
afterEach(() => vi.clearAllMocks())

describe('POST /workspace/orders/:id/submit-approval (02-А)', () => {
  const SUBMITTABLE = {
    id: 'order-1',
    internalStatus: 'estimating',
    approvalStatus: null,
    billingType: 'fixed',
    fixedPrice: '500.00',
    hourlyRate: null,
    estimatedHours: null,
  }

  it('team submits a fixed estimate → pending + pending_approval + outbox', async () => {
    orderFindFirst.mockResolvedValue(SUBMITTABLE)
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      requiresApproval: true,
      approvalStatus: 'pending',
      clientStatus: 'pending_approval',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/orders/order-1/submit-approval', {})
    expect(res.statusCode).toBe(200)
    const data = orderUpdateMany.mock.calls[0][0].data
    expect(data.requiresApproval).toBe(true)
    expect(data.approvalStatus).toBe('pending')
    expect(data.clientStatus).toBe('pending_approval')
    expect(outboxCreate.mock.calls[0][0].data.type).toBe('order.approval_requested')
    await app.close()
  })

  it('hourly estimate (rate + hours) is submittable', async () => {
    orderFindFirst.mockResolvedValue({
      ...SUBMITTABLE,
      billingType: 'hourly',
      fixedPrice: null,
      hourlyRate: '30.00',
      estimatedHours: '10.00',
    })
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      requiresApproval: true,
      approvalStatus: 'pending',
      clientStatus: 'pending_approval',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/orders/order-1/submit-approval', {})
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('400 when there is no estimate to approve', async () => {
    orderFindFirst.mockResolvedValue({ ...SUBMITTABLE, fixedPrice: null })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/orders/order-1/submit-approval', {})
    expect(res.statusCode).toBe(400)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 when the estimate was already approved', async () => {
    orderFindFirst.mockResolvedValue({ ...SUBMITTABLE, approvalStatus: 'approved' })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/orders/order-1/submit-approval', {})
    expect(res.statusCode).toBe(409)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 when work has already started (not a pre-work state)', async () => {
    orderFindFirst.mockResolvedValue({ ...SUBMITTABLE, internalStatus: 'in_progress' })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/orders/order-1/submit-approval', {})
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('403 for a client (not internal team)', async () => {
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/workspace/orders/order-1/submit-approval', {})
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('POST /portal/orders/:id/approval (02-А)', () => {
  const PENDING = { id: 'order-1', companyId: COMPANY, approvalStatus: 'pending' }

  it('owner approves → approved + clientStatus in_progress + outbox', async () => {
    orderFindFirst.mockResolvedValue(PENDING)
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      approvalStatus: 'approved',
      approvalDecidedAt: new Date(),
      approvalComment: null,
      clientStatus: 'in_progress',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/portal/orders/order-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(200)
    const data = orderUpdateMany.mock.calls[0][0].data
    expect(data.approvalStatus).toBe('approved')
    expect(data.approvalDecidedById).toBe('client-1')
    expect(data.clientStatus).toBe('in_progress')
    expect(outboxCreate.mock.calls[0][0].data.type).toBe('order.approval_approved')
    await app.close()
  })

  it('owner rejects with a reason → rejected', async () => {
    orderFindFirst.mockResolvedValue(PENDING)
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      approvalStatus: 'rejected',
      approvalDecidedAt: new Date(),
      approvalComment: 'Задорого',
      clientStatus: 'in_progress',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/portal/orders/order-1/approval', {
      decision: 'reject',
      comment: 'Задорого',
    })
    expect(res.statusCode).toBe(200)
    expect(orderUpdateMany.mock.calls[0][0].data.approvalStatus).toBe('rejected')
    expect(orderUpdateMany.mock.calls[0][0].data.approvalComment).toBe('Задорого')
    expect(outboxCreate.mock.calls[0][0].data.type).toBe('order.approval_rejected')
    await app.close()
  })

  it('400 when rejecting without a reason', async () => {
    orderFindFirst.mockResolvedValue(PENDING)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/portal/orders/order-1/approval', { decision: 'reject' })
    expect(res.statusCode).toBe(400)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('403 for a non-owner company member', async () => {
    orderFindFirst.mockResolvedValue(PENDING)
    const { app, token } = await authed(CLIENT_MEMBER)
    const res = await post(app, token, '/portal/orders/order-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(403)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('a delegated member with can_approve_estimates may decide', async () => {
    orderFindFirst.mockResolvedValue(PENDING)
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      approvalStatus: 'approved',
      approvalDecidedAt: new Date(),
      approvalComment: null,
      clientStatus: 'in_progress',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(CLIENT_DELEGATE)
    const res = await post(app, token, '/portal/orders/order-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(200)
    expect(orderUpdateMany.mock.calls[0][0].data.approvalDecidedById).toBe('client-3')
    await app.close()
  })

  it('a workspace team member cannot self-approve via the portal route (403)', async () => {
    orderFindFirst.mockResolvedValue(PENDING)
    const { app, token } = await authed(TEAM) // has agencyMemberships, no company membership
    const res = await post(app, token, '/portal/orders/order-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(403)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 when there is nothing pending to decide', async () => {
    orderFindFirst.mockResolvedValue({ ...PENDING, approvalStatus: 'approved' })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/portal/orders/order-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(409)
    await app.close()
  })
})

describe('PATCH /orders/:id/status — 02-А in_progress gate', () => {
  const base = {
    id: 'order-1',
    agencyId: AGENCY,
    companyId: COMPANY,
    internalStatus: 'estimating',
    deletedAt: null,
  }

  it('409 blocks → in_progress when approval required and not approved', async () => {
    orderFindUnique.mockResolvedValue({
      ...base,
      requiresApproval: true,
      approvalStatus: 'pending',
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'in_progress' })
    expect(res.statusCode).toBe(409)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(outboxCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('allows → in_progress once the client has approved', async () => {
    orderFindUnique.mockResolvedValue({
      ...base,
      requiresApproval: true,
      approvalStatus: 'approved',
    })
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'in_progress',
      clientStatus: 'in_progress',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'in_progress' })
    expect(res.statusCode).toBe(200)
    expect(orderUpdateMany).toHaveBeenCalled()
    await app.close()
  })

  it('no gate when the order does not require approval', async () => {
    orderFindUnique.mockResolvedValue({ ...base, requiresApproval: false, approvalStatus: null })
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'in_progress',
      clientStatus: 'in_progress',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'in_progress' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('keeps clientStatus=pending_approval when shuffling internal states while pending', async () => {
    // estimating → clarification while the client decision is pending: INTERNAL_TO_CLIENT_STATUS
    // would map to in_progress, but the client still owes a decision → preserve pending_approval.
    orderFindUnique.mockResolvedValue({
      ...base,
      requiresApproval: true,
      approvalStatus: 'pending',
    })
    orderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      internalStatus: 'clarification',
      clientStatus: 'pending_approval',
      onHoldReason: null,
      cancelledReason: null,
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'clarification' })
    expect(res.statusCode).toBe(200)
    expect(orderUpdateMany.mock.calls[0][0].data.clientStatus).toBe('pending_approval')
    await app.close()
  })
})

describe('PATCH /orders/:id — 02-А billing-edit lock', () => {
  const base = {
    id: 'order-1',
    agencyId: AGENCY,
    companyId: COMPANY,
    internalStatus: 'estimating',
    deletedAt: null,
  }

  it('409 blocks a fixedPrice change while approval is pending', async () => {
    orderFindUnique.mockResolvedValue({ ...base, approvalStatus: 'pending' })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1', { fixedPrice: 999 })
    expect(res.statusCode).toBe(409)
    expect(orderUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 blocks a billing change after the client approved', async () => {
    orderFindUnique.mockResolvedValue({ ...base, approvalStatus: 'approved' })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1', { hourlyRate: 50 })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('allows revising the estimate after a rejection', async () => {
    orderFindUnique.mockResolvedValue({ ...base, approvalStatus: 'rejected' })
    orderUpdate.mockResolvedValue({
      id: 'order-1',
      title: 'X',
      description: null,
      priority: 'medium',
      deadline: null,
      clientStatus: 'in_progress',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1', { fixedPrice: 800 })
    expect(res.statusCode).toBe(200)
    expect(orderUpdate.mock.calls[0][0].data.fixedPrice).toBe(800)
    await app.close()
  })

  it('non-billing edits are allowed even while pending', async () => {
    orderFindUnique.mockResolvedValue({ ...base, approvalStatus: 'pending' })
    orderUpdate.mockResolvedValue({
      id: 'order-1',
      title: 'Новий',
      description: null,
      priority: 'medium',
      deadline: null,
      clientStatus: 'pending_approval',
      updatedAt: new Date(),
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1', { title: 'Новий' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('PATCH /orders/:id/status — 02-В advance gate (hourly_prepaid + moneyBalance)', () => {
  const base = {
    id: 'order-1',
    agencyId: AGENCY,
    companyId: COMPANY,
    internalStatus: 'estimating',
    requiresApproval: false,
    approvalStatus: null,
    deletedAt: null,
  }
  const started = {
    id: 'order-1',
    internalStatus: 'in_progress',
    clientStatus: 'in_progress',
    onHoldReason: null,
    cancelledReason: null,
    updatedAt: new Date(),
  }

  it('409 blocks → in_progress when a prepaid client still owes (balance < 0)', async () => {
    orderFindUnique.mockResolvedValue({
      ...base,
      project: { billingModel: 'hourly_prepaid' },
      company: { moneyBalance: new Prisma.Decimal(-150) }, // advance unpaid
    })
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'in_progress' })
    expect(res.statusCode).toBe(409)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('allows → in_progress once the advance is paid (balance ≥ 0)', async () => {
    orderFindUnique.mockResolvedValue({
      ...base,
      project: { billingModel: 'hourly_prepaid' },
      company: { moneyBalance: new Prisma.Decimal(0) },
    })
    orderFindUniqueOrThrow.mockResolvedValue(started)
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'in_progress' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('does not gate non-prepaid projects even when the client owes', async () => {
    orderFindUnique.mockResolvedValue({
      ...base,
      project: { billingModel: 'hourly_postpaid' },
      company: { moneyBalance: new Prisma.Decimal(-150) },
    })
    orderFindUniqueOrThrow.mockResolvedValue(started)
    const { app, token } = await authed(TEAM)
    const res = await patch(app, token, '/orders/order-1/status', { status: 'in_progress' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
