import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// P-11c — on_actuals charge release routes (workspace internal + portal client) + counter-offer.
// Route-level over a real app with a mocked @workflo/db (mirrors orderApproval.test.ts).
const chargeFindFirst = vi.fn()
const chargeUpdateMany = vi.fn()
const chargeFindUniqueOrThrow = vi.fn()
const outboxCreate = vi.fn()
const auditLogCreate = vi.fn()
const companyUpdate = vi.fn()
const paymentAggregate = vi.fn()
const walletAggregate = vi.fn()
const queryRaw = vi.fn()

function txImpl(arg: unknown) {
  if (typeof arg === 'function') {
    return (arg as (tx: unknown) => unknown)({
      serviceCharge: { updateMany: chargeUpdateMany, findUniqueOrThrow: chargeFindUniqueOrThrow },
      outboxEvent: { create: outboxCreate },
      payment: { aggregate: paymentAggregate },
      walletTransaction: { aggregate: walletAggregate },
      company: { update: companyUpdate },
      $queryRaw: queryRaw,
    })
  }
  return Promise.all(arg as Promise<unknown>[])
}
const transaction = vi.fn(txImpl)

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  const prisma = {
    serviceCharge: { findFirst: chargeFindFirst },
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
const MANAGER = {
  ...TEAM,
  sub: 'mgr-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
}

// internal-approver charge (workspace releases it); client variant overrides agency floor.
const INTERNAL_CHARGE = {
  id: 'ch-1',
  agencyId: AGENCY,
  companyId: COMPANY,
  totalAmount: '150.00',
  amount: '150.00',
  approvalStatus: 'pending',
  project: { invoiceApprover: 'internal' },
  company: { invoiceApprover: null },
  agency: { defaultInvoiceApprover: 'client' },
}
const CLIENT_CHARGE = { ...INTERNAL_CHARGE, project: { invoiceApprover: 'client' } }

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

beforeEach(() => {
  vi.clearAllMocks()
  auditLogCreate.mockResolvedValue({})
  outboxCreate.mockResolvedValue({})
  chargeUpdateMany.mockResolvedValue({ count: 1 })
  companyUpdate.mockResolvedValue({})
  paymentAggregate.mockResolvedValue({ _sum: { amountUsd: null } })
  walletAggregate.mockResolvedValue({ _sum: { amount: null } })
  // One return serves both refreshMoneyBalance $queryRaw calls (FOR UPDATE row + charged sum).
  queryRaw.mockResolvedValue([{ id: COMPANY, agencyId: AGENCY, charged: 0 }])
  chargeFindUniqueOrThrow.mockResolvedValue({
    id: 'ch-1',
    approvalStatus: 'approved',
    totalAmount: '150.00',
    amount: '150.00',
    approvedAmount: null,
  })
})
afterEach(() => vi.clearAllMocks())

describe('POST /workspace/billing/charges/:id/approval (P-11c, internal)', () => {
  it('team releases a draft → approved + balance refresh + outbox', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
    })
    expect(res.statusCode).toBe(200)
    const data = chargeUpdateMany.mock.calls[0][0].data
    expect(data.approvalStatus).toBe('approved')
    expect(companyUpdate).toHaveBeenCalled() // refreshMoneyBalance ran
    expect(outboxCreate.mock.calls[0][0].data.type).toBe('charge.approval_approved')
    await app.close()
  })

  it('counter-offer (approvedAmount < billed) lowers totalAmount', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
      approvedAmount: 120,
    })
    expect(res.statusCode).toBe(200)
    const data = chargeUpdateMany.mock.calls[0][0].data
    expect(data.totalAmount.toString()).toBe('120') // billed 150 → final 120
    expect(data.approvedAmount.toString()).toBe('120')
    await app.close()
  })

  it('400 when approvedAmount exceeds billed', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
      approvedAmount: 200,
    })
    expect(res.statusCode).toBe(400)
    expect(chargeUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('reject with reason → rejected, no balance refresh', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    chargeFindUniqueOrThrow.mockResolvedValue({ id: 'ch-1', approvalStatus: 'rejected' })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'reject',
      comment: 'Завищено',
    })
    expect(res.statusCode).toBe(200)
    expect(chargeUpdateMany.mock.calls[0][0].data.approvalStatus).toBe('rejected')
    expect(companyUpdate).not.toHaveBeenCalled() // rejection leaves the charge inert
    await app.close()
  })

  it('400 reject without a reason', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'reject',
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('403 wrong channel: workspace cannot release a client-approver charge', async () => {
    chargeFindFirst.mockResolvedValue(CLIENT_CHARGE)
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
    })
    expect(res.statusCode).toBe(403)
    expect(chargeUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 when the charge is not pending', async () => {
    chargeFindFirst.mockResolvedValue({ ...INTERNAL_CHARGE, approvalStatus: 'approved' })
    const { app, token } = await authed(TEAM)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('403 for a client on the workspace route', async () => {
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('403 for an agency manager (finance-blocked, MOD-4)', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    const { app, token } = await authed(MANAGER)
    const res = await post(app, token, '/workspace/billing/charges/ch-1/approval', {
      decision: 'approve',
    })
    expect(res.statusCode).toBe(403)
    expect(chargeUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /portal/charges/:id/approval (P-11c, client)', () => {
  it('company owner releases a client-approver charge', async () => {
    chargeFindFirst.mockResolvedValue(CLIENT_CHARGE)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/portal/charges/ch-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(200)
    expect(chargeUpdateMany.mock.calls[0][0].data.approvalStatus).toBe('approved')
    await app.close()
  })

  it('403 for a non-owner company member', async () => {
    chargeFindFirst.mockResolvedValue(CLIENT_CHARGE)
    const { app, token } = await authed(CLIENT_MEMBER)
    const res = await post(app, token, '/portal/charges/ch-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(403)
    expect(chargeUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('403 wrong channel: client cannot release an internal-approver charge', async () => {
    chargeFindFirst.mockResolvedValue(INTERNAL_CHARGE)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await post(app, token, '/portal/charges/ch-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('403 internal user cannot use the portal route (no client membership)', async () => {
    chargeFindFirst.mockResolvedValue(CLIENT_CHARGE)
    const { app, token } = await authed(TEAM) // memberships: []
    const res = await post(app, token, '/portal/charges/ch-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(403)
    expect(chargeUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('403 cross-company: owner of company A cannot release company B charge (IDOR)', async () => {
    chargeFindFirst.mockResolvedValue({
      ...CLIENT_CHARGE,
      companyId: '22222222-2222-4222-8222-222222222222',
    })
    const { app, token } = await authed(CLIENT_OWNER) // owns COMPANY, not the other
    const res = await post(app, token, '/portal/charges/ch-1/approval', { decision: 'approve' })
    expect(res.statusCode).toBe(403)
    expect(chargeUpdateMany).not.toHaveBeenCalled()
    await app.close()
  })
})
