import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hashRequest, withIdempotency } from '../../src/services/idempotency.js'
import { confirmManualPayment } from '../../src/services/payments.js'

/**
 * Money-correctness against REAL Postgres (S5-02 — the guarantees that a mocked
 * client cannot prove): idempotent `Idempotency-Key` via `INSERT … ON CONFLICT`,
 * and single-settlement under concurrent confirms via `SELECT … FOR UPDATE`. A
 * double-clicked payment must produce ONE row; two racing full-settlements of one
 * order must yield exactly one success + one 409; an FX snapshot must be immutable.
 *
 * Gated on RUN_DB_TESTS=1 + a migrated DATABASE_URL (same harness as the RLS
 * isolation suite); skipped in the default mocked unit run, run in CI's
 * db-integration job.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

const ENDPOINT = 'POST /test/billing/payments'

run('S5-02 payments — idempotency + concurrency (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const creatorId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  /** Full idempotency + confirm envelope, exactly as the route composes it. */
  function confirm(opts: {
    key: string
    orderId?: string
    amount: number
    currency?: 'USD' | 'UAH' | 'EUR'
  }) {
    const requestHash = hashRequest({ companyId, ...opts })
    return tenantTransaction(prisma, (tx) =>
      withIdempotency(
        tx,
        { key: opts.key, endpoint: ENDPOINT, agencyId, requestHash },
        async () => {
          const r = await confirmManualPayment(tx, {
            agencyId,
            companyId,
            orderId: opts.orderId ?? null,
            amount: opts.amount,
            currency: opts.currency ?? 'USD',
            type: 'final',
            confirmedBy: creatorId,
            idempotencyKey: opts.key,
          })
          return { status: 201, body: r }
        }
      )
    )
  }

  async function seedOrder(total: number, currency = 'USD'): Promise<string> {
    const o = await prisma.order.create({
      data: {
        agencyId,
        companyId,
        title: `order-${randomUUID().slice(0, 6)}`,
        createdById: creatorId,
        totalAmount: total,
        currency,
      },
      select: { id: true },
    })
    return o.id
  }

  beforeAll(async () => {
    await prisma.profile.create({
      data: {
        id: creatorId,
        email: `pay-${tag}@test.local`,
        passwordHash: 'x',
        name: 'Payer Seed',
      },
    })
    await prisma.agency.create({ data: { id: agencyId, name: `pay-${tag}`, slug: `pay-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'Payer Co', slug: `payer-${tag}` },
    })
  })

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
    await prisma.order.deleteMany({ where: { agencyId } })
    await prisma.exchangeRate.deleteMany({ where: { agencyId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.profile.deleteMany({ where: { id: creatorId } })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { agencyId } })
    await prisma.payment.deleteMany({ where: { agencyId } })
  })

  it('replay: same key + same body twice → ONE payment, identical response', async () => {
    const orderId = await seedOrder(500)
    const key = `repl-${randomUUID()}`

    const first = await confirm({ key, orderId, amount: 500 })
    const second = await confirm({ key, orderId, amount: 500 })

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.body).toEqual(first.body)

    const count = await prisma.payment.count({ where: { orderId } })
    expect(count).toBe(1)
  })

  it('422 when the same key is reused with a different body', async () => {
    const orderId = await seedOrder(500)
    const key = `reuse-${randomUUID()}`
    await confirm({ key, orderId, amount: 500 })
    await expect(confirm({ key, orderId, amount: 250 })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('double-click: two parallel confirms, SAME key → ONE payment row', async () => {
    const orderId = await seedOrder(500)
    const key = `dbl-${randomUUID()}`

    const results = await Promise.allSettled([
      confirm({ key, orderId, amount: 500 }),
      confirm({ key, orderId, amount: 500 }),
    ])

    // Both envelopes resolve (one runs, one replays/serializes) — never two rows.
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    expect(fulfilled.length).toBeGreaterThanOrEqual(1)
    const count = await prisma.payment.count({ where: { orderId } })
    expect(count).toBe(1)
  })

  it('race: two DISTINCT keys fully settling one order → exactly one 409', async () => {
    const orderId = await seedOrder(100)

    const results = await Promise.allSettled([
      confirm({ key: `ra-${randomUUID()}`, orderId, amount: 100 }),
      confirm({ key: `rb-${randomUUID()}`, orderId, amount: 100 }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const conflicts = results.filter(
      (r) => r.status === 'rejected' && (r.reason as { statusCode?: number }).statusCode === 409
    )
    expect(fulfilled).toHaveLength(1)
    expect(conflicts).toHaveLength(1)

    // FOR UPDATE serialized them: one payment, order marked paid exactly once.
    const count = await prisma.payment.count({ where: { orderId } })
    expect(count).toBe(1)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { paidAt: true },
    })
    expect(order?.paidAt).not.toBeNull()
  })

  it('advance + final settle an order across two payments → paidAt set, debt 0', async () => {
    const orderId = await seedOrder(1000)

    const adv = await confirm({ key: `adv-${randomUUID()}`, orderId, amount: 400 })
    expect(adv.body).toMatchObject({ newDebt: '600.00', orderPaidAt: null })

    const fin = await confirm({ key: `fin-${randomUUID()}`, orderId, amount: 600 })
    const body = fin.body as { newDebt: string; orderPaidAt: string | null }
    expect(body.newDebt).toBe('0.00')
    expect(body.orderPaidAt).not.toBeNull()

    const count = await prisma.payment.count({ where: { orderId } })
    expect(count).toBe(2)
  })

  it('FX snapshot is immutable: a later rate change does not move stored amountUsd', async () => {
    await prisma.exchangeRate.upsert({
      where: { agencyId },
      create: { agencyId, usdToUah: 40, updatedBy: 'test' },
      update: { usdToUah: 40 },
    })

    const res = await confirm({ key: `fx-${randomUUID()}`, amount: 4000, currency: 'UAH' })
    const body = res.body as { payment: { amountUsd: string; rateUsed: string } }
    expect(body.payment.amountUsd).toBe('100.00') // 4000 / 40
    expect(body.payment.rateUsed).toBe('40')

    // Move the rate — the historical snapshot must NOT change.
    await prisma.exchangeRate.update({ where: { agencyId }, data: { usdToUah: 50 } })
    const stored = await prisma.payment.findFirst({
      where: { agencyId, currency: 'UAH' },
      select: { amountUsd: true },
      orderBy: { confirmedAt: 'desc' },
    })
    expect(stored?.amountUsd?.toFixed(2)).toBe('100.00')
  })

  it('EUR payment snapshots USD via eurToUah ÷ usdToUah (P-8)', async () => {
    await prisma.exchangeRate.upsert({
      where: { agencyId },
      create: { agencyId, usdToUah: 40, eurToUah: 44, updatedBy: 'test' },
      update: { usdToUah: 40, eurToUah: 44 },
    })
    const res = await confirm({ key: `eur-${randomUUID()}`, amount: 100, currency: 'EUR' })
    const body = res.body as { payment: { amountUsd: string } }
    expect(body.payment.amountUsd).toBe('110.00') // 100 × 44 / 40
  })

  it('EUR payment with no eurToUah rate → 422 (no silent NULL amountUsd)', async () => {
    await prisma.exchangeRate.upsert({
      where: { agencyId },
      create: { agencyId, usdToUah: 40, eurToUah: null, updatedBy: 'test' },
      update: { usdToUah: 40, eurToUah: null },
    })
    await expect(
      confirm({ key: `eur-miss-${randomUUID()}`, amount: 100, currency: 'EUR' })
    ).rejects.toThrow(/EUR|євро|Курс/)
  })
})
