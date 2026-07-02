import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const memberFindUnique = vi.fn()
const memberFindMany = vi.fn()
const rateFindMany = vi.fn()
const rateFindFirst = vi.fn()
const rateCreate = vi.fn()
const rateUpdateMany = vi.fn()
const payoutFindUnique = vi.fn()
const payoutFindMany = vi.fn()
const payoutUpsert = vi.fn()
const payoutUpdate = vi.fn()
const timeLogAggregate = vi.fn()
const paymentAggregate = vi.fn()
const auditLogCreate = vi.fn()
const referralSettingsFindUnique = vi.fn() // P-9b: employee-referral % lookup in generatePayout
const companyFindMany = vi.fn() // P-9b: an employee's referred clients

let Dec: (v: string | number) => unknown

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v)
  const prisma = {
    agencyMember: { findUnique: memberFindUnique, findMany: memberFindMany },
    executorRate: {
      findMany: rateFindMany,
      findFirst: rateFindFirst,
      create: rateCreate,
      updateMany: rateUpdateMany,
    },
    executorPayout: {
      findUnique: payoutFindUnique,
      findMany: payoutFindMany,
      upsert: payoutUpsert,
      update: payoutUpdate,
    },
    timeLog: { aggregate: timeLogAggregate },
    payment: { aggregate: paymentAggregate },
    auditLog: { create: auditLogCreate },
    referralSettings: { findUnique: referralSettingsFindUnique },
    company: { findMany: companyFindMany },
    // rates POST / zero-cost PATCH беруть advisory lock перед close/create вікна
    $executeRaw: (() => Promise.resolve(1)) as unknown,
  }
  return {
    prisma,
    Prisma,
    tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { generatePayout } = await import('../src/services/payout.js')
const { buildApp } = await import('../src/app.js')

const mockTx = {
  executorPayout: { findUnique: payoutFindUnique, upsert: payoutUpsert },
  executorRate: { findFirst: rateFindFirst },
  timeLog: { aggregate: timeLogAggregate },
  payment: { aggregate: paymentAggregate },
  referralSettings: { findUnique: referralSettingsFindUnique },
  company: { findMany: companyFindMany },
}

const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const CLIENT = {
  sub: 'p1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const EXEC_ID = '11111111-1111-4111-8111-111111111111'
const PAYOUT_ID = '33333333-3333-4333-8333-333333333333'

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  auditLogCreate.mockResolvedValue({})
  referralSettingsFindUnique.mockResolvedValue(null) // P-9b: no settings → 0% → no bonus
  companyFindMany.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

// ════════════════════════════════════════════════════════════════════════════
describe('generatePayout (service)', () => {
  it('total = salary + commission%×revenue (hourlyEarned 0)', async () => {
    payoutFindUnique.mockResolvedValue(null) // no existing payout
    rateFindFirst.mockResolvedValue({
      monthlySalary: Dec('1000.00'),
      commissionPercent: Dec('10.00'),
      currency: 'USD',
    })
    timeLogAggregate.mockResolvedValue({ _sum: { hours: Dec('20.00') } })
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('5000.00') } }) // commission base
    payoutUpsert.mockImplementation(({ create }: { create: Record<string, unknown> }) =>
      Promise.resolve({
        id: PAYOUT_ID,
        executorId: EXEC_ID,
        period: '2026-06',
        ...create,
        status: 'draft',
        approvedBy: null,
        paidAt: null,
      })
    )
    const res = await generatePayout(mockTx as never, {
      agencyId: 'agency-1',
      executorId: EXEC_ID,
      period: '2026-06',
    })
    expect(res.baseSalary).toBe('1000.00')
    expect(res.billableHours).toBe('20.00')
    expect(res.hourlyEarned).toBe('0.00')
    expect(res.commissionAmount).toBe('500.00') // 10% of 5000
    expect(res.total).toBe('1500.00')
  })

  it('does not recompute an approved payout (idempotent / no clobber)', async () => {
    payoutFindUnique.mockResolvedValue({
      id: PAYOUT_ID,
      executorId: EXEC_ID,
      period: '2026-06',
      baseSalary: Dec('1000.00'),
      billableHours: Dec('0.00'),
      hourlyEarned: Dec('0.00'),
      commissionAmount: Dec('0.00'),
      referralBonusAmount: Dec('0.00'),
      total: Dec('1000.00'),
      currency: 'USD',
      status: 'approved',
      approvedBy: 'owner-1',
      paidAt: null,
    })
    const res = await generatePayout(mockTx as never, {
      agencyId: 'agency-1',
      executorId: EXEC_ID,
      period: '2026-06',
    })
    expect(res.status).toBe('approved')
    expect(payoutUpsert).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('executor rates', () => {
  it('owner appends a new rate (closes the open window)', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateUpdateMany.mockResolvedValue({ count: 1 })
    rateCreate.mockResolvedValue({
      id: 'r2',
      monthlySalary: Dec('2000.00'),
      commissionPercent: Dec('5.00'),
      currency: 'USD',
      effectiveFrom: new Date(),
      effectiveUntil: null,
      hireDate: null,
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${token}` },
      payload: { monthlySalary: 2000, commissionPercent: 5 },
    })
    expect(res.statusCode).toBe(201)
    // the previous open window was closed before the new row was created
    expect(rateUpdateMany.mock.calls[0][0].where.effectiveUntil).toBeNull()
    expect(rateUpdateMany.mock.calls[0][0].data.effectiveUntil).toBeInstanceOf(Date)
    await app.close()
  })

  it('non-owner executor cannot set rates (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${token}` },
      payload: { monthlySalary: 2000 },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 when the executor is not an agency member', async () => {
    memberFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${token}` },
      payload: { monthlySalary: 2000 },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('400 with neither salary nor commission', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${token}` },
      payload: { currency: 'USD' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('owner lists any executor rate history', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateFindMany.mockResolvedValue([])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('executor reads their OWN rates (200) but not another executor (403)', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateFindMany.mockResolvedValue([])
    const own = await authed({ ...EXECUTOR, sub: EXEC_ID })
    const ownRes = await own.app.inject({
      method: 'GET',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${own.token}` },
    })
    expect(ownRes.statusCode).toBe(200)
    await own.app.close()

    const other = await authed(EXECUTOR) // sub='exec-1' ≠ EXEC_ID
    const otherRes = await other.app.inject({
      method: 'GET',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${other.token}` },
    })
    expect(otherRes.statusCode).toBe(403)
    await other.app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('PATCH /workspace/executors/:id/zero-cost (22/P-5)', () => {
  const url = `/workspace/executors/${EXEC_ID}/zero-cost`
  const OPEN_RATE = {
    id: 'r1',
    monthlySalary: null as unknown,
    hourlyRate: null,
    commissionPercent: null as unknown,
    currency: 'EUR',
    effectiveFrom: new Date('2026-06-01T00:00:00Z'),
    effectiveUntil: null,
    hireDate: null,
    zeroCostDefault: false,
  }
  beforeEach(() => {
    OPEN_RATE.monthlySalary = Dec('2000.00')
    OPEN_RATE.commissionPercent = Dec('5.00')
  })

  it('owner flips the flag: closes the window, compensation values carry over', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateFindFirst.mockResolvedValue(OPEN_RATE)
    rateUpdateMany.mockResolvedValue({ count: 1 })
    rateCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...OPEN_RATE, id: 'r2', ...data })
    )
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url,
      headers: { authorization: `Bearer ${token}` },
      payload: { zeroCostDefault: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rate.zeroCostDefault).toBe(true)
    // the old open window was closed, the new one carries the values
    expect(rateUpdateMany).toHaveBeenCalledOnce()
    const created = rateCreate.mock.calls[0][0].data
    expect(created.monthlySalary).toEqual(OPEN_RATE.monthlySalary)
    expect(created.commissionPercent).toEqual(OPEN_RATE.commissionPercent)
    expect(created.currency).toBe('EUR')
    expect(created.zeroCostDefault).toBe(true)
    await app.close()
  })

  it('no-op when the flag already matches (no window churn)', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateFindFirst.mockResolvedValue({ ...OPEN_RATE, zeroCostDefault: true })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url,
      headers: { authorization: `Bearer ${token}` },
      payload: { zeroCostDefault: true },
    })
    expect(res.statusCode).toBe(200)
    expect(rateUpdateMany).not.toHaveBeenCalled()
    expect(rateCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('no open window → creates a fresh row with defaults + the flag', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateFindFirst.mockResolvedValue(null)
    rateUpdateMany.mockResolvedValue({ count: 0 })
    rateCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...OPEN_RATE, id: 'r3', ...data })
    )
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url,
      headers: { authorization: `Bearer ${token}` },
      payload: { zeroCostDefault: true },
    })
    expect(res.statusCode).toBe(200)
    const created = rateCreate.mock.calls[0][0].data
    expect(created.monthlySalary).toBeNull()
    expect(created.currency).toBe('USD')
    expect(created.zeroCostDefault).toBe(true)
    await app.close()
  })

  it('non-owner cannot flip the flag (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url,
      headers: { authorization: `Bearer ${token}` },
      payload: { zeroCostDefault: true },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 when the executor is not an agency member', async () => {
    memberFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url,
      headers: { authorization: `Bearer ${token}` },
      payload: { zeroCostDefault: false },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('POST /rates carries the zero-cost flag into the new window (no silent reset)', async () => {
    memberFindUnique.mockResolvedValue({ id: 'm1' })
    rateFindFirst.mockResolvedValue({ zeroCostDefault: true })
    rateUpdateMany.mockResolvedValue({ count: 1 })
    rateCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...OPEN_RATE, id: 'r4', ...data })
    )
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/executors/${EXEC_ID}/rates`,
      headers: { authorization: `Bearer ${token}` },
      payload: { monthlySalary: 3000 },
    })
    expect(res.statusCode).toBe(201)
    expect(rateCreate.mock.calls[0][0].data.zeroCostDefault).toBe(true)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('payout workflow', () => {
  function draftPayout(over: Record<string, unknown> = {}) {
    return {
      id: PAYOUT_ID,
      agencyId: 'agency-1',
      executorId: EXEC_ID,
      period: '2026-06',
      baseSalary: Dec('1000.00'),
      billableHours: Dec('0.00'),
      hourlyEarned: Dec('0.00'),
      commissionAmount: Dec('0.00'),
      referralBonusAmount: Dec('0.00'),
      total: Dec('1000.00'),
      currency: 'USD',
      status: 'draft',
      approvedBy: null,
      paidAt: null,
      ...over,
    }
  }

  it('owner generates payouts for the team', async () => {
    memberFindMany.mockResolvedValue([{ profileId: EXEC_ID }])
    payoutFindUnique.mockResolvedValue(null)
    rateFindFirst.mockResolvedValue({
      monthlySalary: Dec('1000.00'),
      commissionPercent: Dec('0'),
      currency: 'USD',
    })
    timeLogAggregate.mockResolvedValue({ _sum: { hours: null } })
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: null } })
    payoutUpsert.mockResolvedValue(draftPayout())
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/team/payouts/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { period: '2026-06' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.payouts).toHaveLength(1)
    await app.close()
  })

  it('non-owner cannot generate (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/team/payouts/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { period: '2026-06' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('approve: draft → approved sets approvedBy', async () => {
    payoutFindUnique.mockResolvedValue({ id: PAYOUT_ID, agencyId: 'agency-1', status: 'draft' })
    payoutUpdate.mockResolvedValue(draftPayout({ status: 'approved', approvedBy: 'owner-1' }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/team/payouts/${PAYOUT_ID}/approve`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(payoutUpdate.mock.calls[0][0].data).toEqual({
      status: 'approved',
      approvedBy: 'owner-1',
    })
    await app.close()
  })

  it('approve rejects a non-draft payout (409)', async () => {
    payoutFindUnique.mockResolvedValue({ id: PAYOUT_ID, agencyId: 'agency-1', status: 'paid' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/team/payouts/${PAYOUT_ID}/approve`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('mark-paid requires an approved payout (409 on draft)', async () => {
    payoutFindUnique.mockResolvedValue({ id: PAYOUT_ID, agencyId: 'agency-1', status: 'draft' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/team/payouts/${PAYOUT_ID}/mark-paid`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('mark-paid: approved → paid sets paidAt', async () => {
    payoutFindUnique.mockResolvedValue({ id: PAYOUT_ID, agencyId: 'agency-1', status: 'approved' })
    payoutUpdate.mockResolvedValue(draftPayout({ status: 'paid', paidAt: new Date() }))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/workspace/team/payouts/${PAYOUT_ID}/mark-paid`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(payoutUpdate.mock.calls[0][0].data.status).toBe('paid')
    await app.close()
  })

  it('list: internal team, optional period filter', async () => {
    payoutFindMany.mockResolvedValue([])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/team/payouts?period=2026-06',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(payoutFindMany.mock.calls[0][0].where.period).toBe('2026-06')
    await app.close()
  })

  it('a non-owner executor lists ONLY their own payouts (compensation is owner-only)', async () => {
    payoutFindMany.mockResolvedValue([])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/team/payouts',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(payoutFindMany.mock.calls[0][0].where.executorId).toBe(EXECUTOR.sub)
    await app.close()
  })

  it('the owner lists the whole team (no executor scope)', async () => {
    payoutFindMany.mockResolvedValue([])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/team/payouts',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(payoutFindMany.mock.calls[0][0].where.executorId).toBeUndefined()
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /workspace/team', () => {
  it('internal team lists members with their active rate', async () => {
    memberFindMany.mockResolvedValue([
      {
        profileId: EXEC_ID,
        role: 'executor',
        createdAt: new Date(),
        profile: { name: 'Olena', email: 'o@x.com' },
      },
    ])
    rateFindMany.mockResolvedValue([
      {
        executorId: EXEC_ID,
        monthlySalary: Dec('1500.00'),
        commissionPercent: Dec('5.00'),
        currency: 'USD',
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/team',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const m = res.json().data.members[0]
    expect(m.name).toBe('Olena')
    expect(m.rate.monthlySalary).toBe('1500.00')
    await app.close()
  })

  it('client cannot list the team (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/team',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
