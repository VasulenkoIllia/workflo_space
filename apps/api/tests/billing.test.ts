import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ── Mock state (set per-test) ────────────────────────────────────────────────
const companyFindUnique = vi.fn()
const paymentCreate = vi.fn()
const paymentAggregate = vi.fn()
const paymentFindMany = vi.fn()
const paymentCount = vi.fn()
const orderUpdate = vi.fn()
const exchangeRateFindUnique = vi.fn()
// S13-06: резолв юр-особи-отримувача у confirm-флоу
const orderFindUnique = vi.fn()
const legalEntityFindFirst = vi.fn()
const idempotencyUpdate = vi.fn()
const serviceChargeFindMany = vi.fn()
const projectFindMany = vi.fn()
const paymentSettingsFindUnique = vi.fn()
const paymentSettingsUpsert = vi.fn()
const auditLogCreate = vi.fn()
const executeRaw = vi.fn()
// AR-11: a no-order confirm now refreshes Company.moneyBalance in the same tx.
const companyUpdate = vi.fn()
const walletTxAggregate = vi.fn()
// email-блок 03.07: createPayment ставить квитанцію клієнту в outbox у тій самій tx.
const outboxCreate = vi.fn()

let orderLockRows: unknown[] = []
let companyLockRows: unknown[] = []
let chargedSumRows: unknown[] = []
let idemExistingRows: unknown[] = []
let overviewDebtRows: unknown[] = []
let portalDebtRows: unknown[] = []

const queryRaw = vi.fn((strings: TemplateStringsArray) => {
  const sql = Array.isArray(strings) ? strings.join('?') : String(strings)
  if (sql.includes('"companies"') && sql.includes('FOR UPDATE'))
    return Promise.resolve(companyLockRows)
  if (sql.includes('"service_charges"') && sql.includes('charged'))
    return Promise.resolve(chargedSumRows)
  if (sql.includes('FOR UPDATE')) return Promise.resolve(orderLockRows)
  if (sql.includes('idempotency_keys')) return Promise.resolve(idemExistingRows)
  if (sql.includes('c."name"')) return Promise.resolve(overviewDebtRows)
  if (sql.includes('"orders" o')) return Promise.resolve(portalDebtRows)
  return Promise.resolve([])
})

// Real Prisma.Decimal (for the money arithmetic in the service) via importOriginal.
let Dec: (v: string | number) => { toFixed: (n: number) => string }

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    Prisma: { Decimal: new (v: string | number) => unknown }
  }
  const Prisma = actual.Prisma
  Dec = (v: string | number) => new Prisma.Decimal(v) as never
  const prisma = {
    company: { findUnique: companyFindUnique, update: companyUpdate },
    walletTransaction: { aggregate: walletTxAggregate },
    payment: {
      create: paymentCreate,
      aggregate: paymentAggregate,
      findMany: paymentFindMany,
      count: paymentCount,
    },
    order: { update: orderUpdate, findUnique: orderFindUnique },
    legalEntity: { findFirst: legalEntityFindFirst },
    exchangeRate: { findUnique: exchangeRateFindUnique },
    idempotencyKey: { update: idempotencyUpdate },
    serviceCharge: { findMany: serviceChargeFindMany },
    project: { findMany: projectFindMany },
    paymentSettings: { findUnique: paymentSettingsFindUnique, upsert: paymentSettingsUpsert },
    auditLog: { create: auditLogCreate },
    outboxEvent: { create: outboxCreate },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  }
  return {
    prisma,
    Prisma,
    // Run the tenant tx callback directly against the shared mock client.
    tenantTransaction: (client: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

const { hashRequest } = await import('../src/services/idempotency.js')
const { createPaymentSchema } = await import('@workflo/types')
const { buildApp } = await import('../src/app.js')

// ── Actors ───────────────────────────────────────────────────────────────────
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
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
  sub: 'profile-1',
  email: 'u@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: COMPANY_ID,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: COMPANY_ID, role: 'owner' as const }],
}

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

const COMPANY = { id: COMPANY_ID, agencyId: 'agency-1' }
const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const KEY = 'idem-key-12345678'

function resetState() {
  orderLockRows = []
  // AR-11 recompute defaults: company row lockable, zero charges, zero bonus spends.
  companyLockRows = [COMPANY]
  chargedSumRows = [{ charged: Dec('0') }]
  idemExistingRows = []
  overviewDebtRows = []
  portalDebtRows = []
  companyFindUnique.mockResolvedValue(COMPANY)
  companyUpdate.mockResolvedValue({})
  walletTxAggregate.mockResolvedValue({ _sum: { amount: Dec('0') } })
  executeRaw.mockResolvedValue(1) // claimed by default
  idempotencyUpdate.mockResolvedValue({})
  orderUpdate.mockResolvedValue({})
  auditLogCreate.mockResolvedValue({})
  paymentAggregate.mockResolvedValue({ _sum: { amount: Dec('0') } })
}

// ════════════════════════════════════════════════════════════════════════════
describe('POST /workspace/billing/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    // S13-06: дефолт — юр-особа не резолвиться (легасі-платіж, без податку)
    orderFindUnique.mockResolvedValue(null)
    legalEntityFindFirst.mockResolvedValue(null)
  })
  afterEach(() => vi.clearAllMocks())

  function paymentRow(amount: string, currency = 'USD') {
    return {
      id: 'pay-1',
      amount: Dec(amount),
      currency,
      type: 'final',
      confirmedAt: new Date('2026-06-08T10:00:00Z'),
    }
  }

  async function post(claims: unknown, body: unknown, key: string | null = KEY) {
    const { app, token } = await authed(claims)
    const headers: Record<string, string> = { authorization: `Bearer ${token}` }
    if (key) headers['idempotency-key'] = key
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/billing/payments',
      headers,
      payload: body as object,
    })
    await app.close()
    return res
  }

  it('401 without a token', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/billing/payments',
      payload: { companyId: COMPANY_ID, amount: 100 },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('400 when the Idempotency-Key header is missing', async () => {
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 100 }, null)
    expect(res.statusCode).toBe(400)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('403 for a client (not internal team)', async () => {
    const res = await post(CLIENT, { companyId: COMPANY_ID, amount: 100 })
    expect(res.statusCode).toBe(403)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('404 for an unknown company', async () => {
    companyFindUnique.mockResolvedValue(null)
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 100 })
    expect(res.statusCode).toBe(404)
  })

  it('403 for a company in another agency', async () => {
    companyFindUnique.mockResolvedValue({ id: COMPANY_ID, agencyId: 'agency-OTHER' })
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 100 })
    expect(res.statusCode).toBe(403)
  })

  it('400 on an amount with more than 2 decimals', async () => {
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 10.123 })
    expect(res.statusCode).toBe(400)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('400 on a non-positive amount', async () => {
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 0 })
    expect(res.statusCode).toBe(400)
  })

  it('happy path: standalone USD payment → 201, manual + USD snapshot, audit', async () => {
    paymentCreate.mockResolvedValue(paymentRow('250.00'))
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 250 })
    expect(res.statusCode).toBe(201)
    const body = res.json().data
    expect(body.payment.amount).toBe('250.00')
    expect(body.payment.amountUsd).toBe('250.00')
    expect(body.payment.rateUsed).toBe('1')
    expect(body.newDebt).toBe('0')
    expect(body.orderPaidAt).toBeNull()
    // Manual: provider/source NULL, confirmed status, USD snapshot.
    const data = paymentCreate.mock.calls[0][0].data
    expect(data.status).toBe('confirmed')
    expect(data.provider).toBe('manual')
    expect(data.providerPaymentId).toBeNull()
    expect(data.confirmedBy).toBe('exec-1')
    expect(exchangeRateFindUnique).not.toHaveBeenCalled() // USD → no FX lookup
    expect(auditLogCreate).toHaveBeenCalled()
  })

  // ── S13-06: юр-особа-отримувач платежу (податок-на-дохід) ────────────────────
  it('явна legalEntityId: tenant-валідована і записана на платіж', async () => {
    legalEntityFindFirst.mockResolvedValue({ id: 'le-fop' })
    paymentCreate.mockResolvedValue(paymentRow('100.00'))
    const res = await post(EXECUTOR, {
      companyId: COMPANY_ID,
      amount: 100,
      legalEntityId: '11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(201)
    expect(legalEntityFindFirst.mock.calls[0][0].where).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      agencyId: 'agency-1',
    })
    expect(paymentCreate.mock.calls[0][0].data.legalEntityId).toBe('le-fop')
  })

  it('чужа/неіснуюча legalEntityId → 404, платіж не створюється', async () => {
    legalEntityFindFirst.mockResolvedValue(null)
    const res = await post(EXECUTOR, {
      companyId: COMPANY_ID,
      amount: 100,
      legalEntityId: '22222222-2222-4222-8222-222222222222',
    })
    expect(res.statusCode).toBe(404)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('без явної юр-особи: каскад падає на дефолтну юр-особу агенції', async () => {
    legalEntityFindFirst.mockResolvedValue({ id: 'le-default' })
    paymentCreate.mockResolvedValue(paymentRow('100.00'))
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 100 })
    expect(res.statusCode).toBe(201)
    expect(legalEntityFindFirst.mock.calls[0][0].where).toMatchObject({
      agencyId: 'agency-1',
      isDefault: true,
    })
    expect(paymentCreate.mock.calls[0][0].data.legalEntityId).toBe('le-default')
  })

  it('order full payment → order marked paid, newDebt 0', async () => {
    orderLockRows = [
      {
        id: ORDER_ID,
        agencyId: 'agency-1',
        totalAmount: Dec('1000.00'),
        currency: 'USD',
        paidAt: null,
        companyId: COMPANY_ID,
      },
    ]
    paymentCreate.mockResolvedValue(paymentRow('1000.00'))
    paymentAggregate.mockResolvedValue({ _sum: { amount: Dec('1000.00') } })
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, orderId: ORDER_ID, amount: 1000 })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.newDebt).toBe('0.00')
    expect(res.json().data.orderPaidAt).not.toBeNull()
    expect(orderUpdate).toHaveBeenCalledTimes(1)
    expect(orderUpdate.mock.calls[0][0].data.paidAt).toBeInstanceOf(Date)
  })

  it('advance (partial) payment → order NOT marked paid, newDebt remains', async () => {
    orderLockRows = [
      {
        id: ORDER_ID,
        agencyId: 'agency-1',
        totalAmount: Dec('1000.00'),
        currency: 'USD',
        paidAt: null,
        companyId: COMPANY_ID,
      },
    ]
    paymentCreate.mockResolvedValue(paymentRow('400.00'))
    paymentAggregate.mockResolvedValue({ _sum: { amount: Dec('400.00') } })
    const res = await post(EXECUTOR, {
      companyId: COMPANY_ID,
      orderId: ORDER_ID,
      amount: 400,
      type: 'advance',
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.newDebt).toBe('600.00')
    expect(res.json().data.orderPaidAt).toBeNull()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('over-payment → order paid, newDebt clamped to 0', async () => {
    orderLockRows = [
      {
        id: ORDER_ID,
        agencyId: 'agency-1',
        totalAmount: Dec('1000.00'),
        currency: 'USD',
        paidAt: null,
        companyId: COMPANY_ID,
      },
    ]
    paymentCreate.mockResolvedValue(paymentRow('1200.00'))
    paymentAggregate.mockResolvedValue({ _sum: { amount: Dec('1200.00') } })
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, orderId: ORDER_ID, amount: 1200 })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.newDebt).toBe('0.00')
    expect(res.json().data.orderPaidAt).not.toBeNull()
  })

  it('409 when the order is already fully paid', async () => {
    orderLockRows = [
      {
        id: ORDER_ID,
        agencyId: 'agency-1',
        totalAmount: Dec('1000.00'),
        currency: 'USD',
        paidAt: new Date('2026-06-01T00:00:00Z'),
        companyId: COMPANY_ID,
      },
    ]
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, orderId: ORDER_ID, amount: 100 })
    expect(res.statusCode).toBe(409)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('400 when payment currency ≠ order currency', async () => {
    orderLockRows = [
      {
        id: ORDER_ID,
        agencyId: 'agency-1',
        totalAmount: Dec('1000.00'),
        currency: 'USD',
        paidAt: null,
        companyId: COMPANY_ID,
      },
    ]
    const res = await post(EXECUTOR, {
      companyId: COMPANY_ID,
      orderId: ORDER_ID,
      amount: 100,
      currency: 'UAH',
    })
    expect(res.statusCode).toBe(400)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('404 when the order belongs to another tenant', async () => {
    orderLockRows = [
      {
        id: ORDER_ID,
        agencyId: 'agency-OTHER',
        totalAmount: Dec('1000.00'),
        currency: 'USD',
        paidAt: null,
        companyId: COMPANY_ID,
      },
    ]
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, orderId: ORDER_ID, amount: 100 })
    expect(res.statusCode).toBe(404)
  })

  it('UAH payment → FX snapshot (amountUsd = amount / rate, rateUsed stored)', async () => {
    exchangeRateFindUnique.mockResolvedValue({ usdToUah: Dec('40.0000') })
    paymentCreate.mockResolvedValue(paymentRow('4000.00', 'UAH'))
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 4000, currency: 'UAH' })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.payment.amountUsd).toBe('100.00') // 4000 / 40
    expect(res.json().data.payment.rateUsed).toBe('40')
    const data = paymentCreate.mock.calls[0][0].data
    expect(data.amountUsd.toFixed(2)).toBe('100.00')
  })

  it('422 when a non-USD payment has no exchange rate', async () => {
    exchangeRateFindUnique.mockResolvedValue(null)
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 4000, currency: 'UAH' })
    expect(res.statusCode).toBe(422)
    expect(paymentCreate).not.toHaveBeenCalled()
  })

  it('idempotency replay: same key + same body → stored response, no new payment', async () => {
    const body = { companyId: COMPANY_ID, amount: 250 }
    const hash = hashRequest(createPaymentSchema.parse(body))
    executeRaw.mockResolvedValue(0) // conflict → key already exists
    idemExistingRows = [
      {
        requestHash: hash,
        responseStatus: 201,
        responseBody: { success: true, data: { payment: { id: 'pay-1' }, newDebt: '0' } },
      },
    ]
    const res = await post(EXECUTOR, body)
    expect(res.statusCode).toBe(201)
    expect(res.json().data.payment.id).toBe('pay-1')
    expect(paymentCreate).not.toHaveBeenCalled() // replayed, not re-run
    expect(auditLogCreate).not.toHaveBeenCalled() // no re-audit on replay
  })

  it('422 idempotency reuse: same key + different body', async () => {
    executeRaw.mockResolvedValue(0)
    idemExistingRows = [{ requestHash: 'a-different-hash', responseStatus: 201, responseBody: {} }]
    const res = await post(EXECUTOR, { companyId: COMPANY_ID, amount: 999 })
    expect(res.statusCode).toBe(422)
    expect(paymentCreate).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /workspace/billing/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })
  afterEach(() => vi.clearAllMocks())

  it('executor lists agency payments (tenant-scoped, paginated)', async () => {
    paymentFindMany.mockResolvedValue([
      {
        id: 'pay-1',
        companyId: COMPANY_ID,
        orderId: null,
        amount: Dec('250.00'),
        currency: 'USD',
        amountUsd: Dec('250.00'),
        type: 'final',
        status: 'confirmed',
        paymentMethod: null,
        paymentReference: null,
        note: null,
        confirmedAt: new Date('2026-06-08T10:00:00Z'),
        refunds: [], // 05-В: listPayments рахує Σ повернень
      },
    ])
    paymentCount.mockResolvedValue(1)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/billing/payments',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.payments[0].amount).toBe('250.00')
    expect(paymentFindMany.mock.calls[0][0].where.agencyId).toBe('agency-1')
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/billing/payments',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /workspace/billing/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })
  afterEach(() => vi.clearAllMocks())

  it('executor sees revenue + outstanding debt + top debtors', async () => {
    paymentAggregate
      .mockResolvedValueOnce({ _sum: { amountUsd: Dec('500.00') } }) // month
      .mockResolvedValueOnce({ _sum: { amountUsd: Dec('5000.00') } }) // total
    overviewDebtRows = [
      { companyId: COMPANY_ID, name: 'Acme', debt: Dec('600.00') },
      { companyId: 'company-2', name: 'Globex', debt: Dec('150.00') },
    ]
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/billing/overview',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const d = res.json().data
    expect(d.monthlyRevenueUsd).toBe('500.00')
    expect(d.totalRevenueUsd).toBe('5000.00')
    expect(d.outstandingDebt).toBe('750.00')
    expect(d.topDebtors).toHaveLength(2)
    expect(d.topDebtors[0].name).toBe('Acme')
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/billing/overview',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /portal/billing/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })
  afterEach(() => vi.clearAllMocks())

  it('client owner sees debt, tier, discount, bonus, settings', async () => {
    companyFindUnique.mockResolvedValue({
      id: COMPANY_ID,
      agencyId: 'agency-1',
      loyaltyTier: 'regular',
      tierOverride: null,
      bonusBalance: Dec('50.00'),
      moneyBalance: Dec('0.00'),
    })
    paymentAggregate.mockResolvedValue({ _sum: { amountUsd: Dec('1200.00') } })
    portalDebtRows = [{ debt: Dec('300.00') }]
    projectFindMany.mockResolvedValue([])
    paymentSettingsFindUnique.mockResolvedValue({
      bankName: 'PrivatBank',
      iban: 'UA123',
      accountName: 'Acme',
      cryptoUsdt: null,
      notes: null,
      invoiceCurrency: 'UAH',
    })
    exchangeRateFindUnique.mockResolvedValue({ usdToUah: Dec('40.0000') })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/billing/summary',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const d = res.json().data
    expect(d.debt).toBe('300.00')
    expect(d.debtUah).toBe('12000.00') // 300 * 40
    expect(d.totalPaid).toBe('1200.00')
    expect(d.loyaltyTier).toBe('regular')
    expect(d.discountPercent).toBe(3) // REGULAR
    expect(d.bonusBalance).toBe('50.00')
    expect(d.paymentSettings.bankName).toBe('PrivatBank')
    await app.close()
  })

  it('400 with no active company', async () => {
    const { app, token } = await authed({ ...CLIENT, activeCompanyId: null })
    const res = await app.inject({
      method: 'GET',
      url: '/portal/billing/summary',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('GET /portal/billing/charges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })
  afterEach(() => vi.clearAllMocks())

  it('client lists its company charges (scoped)', async () => {
    serviceChargeFindMany.mockResolvedValue([])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/billing/charges?month=2026-06',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.charges).toEqual([])
    const where = serviceChargeFindMany.mock.calls[0][0].where
    expect(where.agencyId).toBe('agency-1')
    expect(where.companyId).toBe(COMPANY_ID)
    await app.close()
  })

  it('400 on a malformed month', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/billing/charges?month=2026-13',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('payment settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })
  afterEach(() => vi.clearAllMocks())

  it('owner updates settings (upsert) + audit', async () => {
    paymentSettingsUpsert.mockResolvedValue({
      bankName: 'Mono',
      iban: 'UA999',
      accountName: null,
      cryptoUsdt: null,
      notes: null,
      invoiceCurrency: 'USD',
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/settings/payment',
      headers: { authorization: `Bearer ${token}` },
      payload: { bankName: 'Mono', iban: 'UA999', invoiceCurrency: 'USD' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.settings.bankName).toBe('Mono')
    expect(paymentSettingsUpsert.mock.calls[0][0].where.agencyId).toBe('agency-1')
    expect(auditLogCreate).toHaveBeenCalled()
    await app.close()
  })

  it('non-owner executor cannot update (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/settings/payment',
      headers: { authorization: `Bearer ${token}` },
      payload: { bankName: 'Mono' },
    })
    expect(res.statusCode).toBe(403)
    expect(paymentSettingsUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('workspace GET returns settings to internal team', async () => {
    paymentSettingsFindUnique.mockResolvedValue({
      bankName: 'Mono',
      iban: null,
      accountName: null,
      cryptoUsdt: null,
      notes: null,
      invoiceCurrency: 'USD',
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/settings/payment',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.settings.bankName).toBe('Mono')
    await app.close()
  })

  it('portal payment-settings returns pay-to details to the client', async () => {
    paymentSettingsFindUnique.mockResolvedValue({
      bankName: 'Mono',
      iban: 'UA1',
      accountName: 'Acme',
      cryptoUsdt: null,
      notes: null,
      invoiceCurrency: 'UAH',
    })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/billing/payment-settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.settings.iban).toBe('UA1')
    await app.close()
  })
})
