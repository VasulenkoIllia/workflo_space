import { Prisma } from '@workflo/db'
import { describe, expect, it, vi } from 'vitest'
import {
  allocatePayment,
  deriveChargeState,
  type AllocatePaymentArgs,
} from '../src/services/allocation.js'

/**
 * S5-07 money-account — unit coverage that needs no DB:
 *  - the pure `deriveChargeState` derivation matrix (awaiting/partial/paid/overdue/overpaid);
 *  - the early guards in `allocatePayment` (not-found / not-confirmed / over-allocation),
 *    which fire BEFORE any charge work, so a minimal fake `tx` suffices. The full
 *    happy path + FOR-UPDATE concurrency are proven against real PG in the
 *    integration suite (`tests/integration/allocation.test.ts`).
 */

const D = (v: string | number) => new Prisma.Decimal(v)
const NOW = new Date('2026-06-08T12:00:00.000Z')
const PAST = new Date('2026-01-01T00:00:00.000Z')
const FUTURE = new Date('2026-12-31T00:00:00.000Z')

describe('deriveChargeState — derivation matrix', () => {
  it('no allocation, no due date → awaiting', () => {
    expect(deriveChargeState(D(0), D(100), null, NOW)).toBe('awaiting')
  })

  it('no allocation, past due → overdue', () => {
    expect(deriveChargeState(D(0), D(100), PAST, NOW)).toBe('overdue')
  })

  it('no allocation, due in the future → awaiting', () => {
    expect(deriveChargeState(D(0), D(100), FUTURE, NOW)).toBe('awaiting')
  })

  it('partial allocation, not yet due → partial', () => {
    expect(deriveChargeState(D(40), D(100), FUTURE, NOW)).toBe('partial')
  })

  it('partial allocation but past due → overdue takes precedence', () => {
    expect(deriveChargeState(D(40), D(100), PAST, NOW)).toBe('overdue')
  })

  it('allocated == total → paid (even if past due)', () => {
    expect(deriveChargeState(D(100), D(100), PAST, NOW)).toBe('paid')
  })

  it('allocated > total → overpaid', () => {
    expect(deriveChargeState(D(150), D(100), null, NOW)).toBe('overpaid')
  })

  it('uses Decimal precision (99.99 of 100.00 → partial, not paid)', () => {
    expect(deriveChargeState(D('99.99'), D('100.00'), FUTURE, NOW)).toBe('partial')
  })

  it('zero-amount charge → awaiting (never paid/overpaid on a 0 total)', () => {
    expect(deriveChargeState(D(0), D(0), null, NOW)).toBe('awaiting')
  })

  it('negative-total credit → paid (never overdue, even past dueDate)', () => {
    // prepaid_credit (over-payment) carries a negative total; it owes nothing.
    expect(deriveChargeState(D(0), D(-30), PAST, NOW)).toBe('paid')
  })
})

describe('allocatePayment — early guards (fake tx)', () => {
  function txWith(overrides: Record<string, unknown>) {
    return overrides as unknown as Prisma.TransactionClient
  }

  const baseArgs: AllocatePaymentArgs = {
    agencyId: 'a1',
    paymentId: 'pay-1',
    allocations: [{ chargeId: 'ch-1', amount: 150 }],
  }

  it('payment not found → 404', async () => {
    const tx = txWith({ $queryRaw: vi.fn().mockResolvedValue([]) })
    await expect(allocatePayment(tx, baseArgs)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('payment belongs to another agency → 404 (tenant guard)', async () => {
    const tx = txWith({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: 'pay-1', agencyId: 'OTHER', companyId: 'c1', amount: D(100), status: 'confirmed' },
        ]),
    })
    await expect(allocatePayment(tx, baseArgs)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('payment not confirmed → 409', async () => {
    const tx = txWith({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: 'pay-1', agencyId: 'a1', companyId: 'c1', amount: D(100), status: 'pending' },
        ]),
    })
    await expect(allocatePayment(tx, baseArgs)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('over-allocation (Σ new > unallocated remainder) → 409', async () => {
    const tx = txWith({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: 'pay-1', agencyId: 'a1', companyId: 'c1', amount: D(100), status: 'confirmed' },
        ]),
      paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
    })
    // amount 100, nothing allocated yet, request 150 → exceeds remainder → 409 before charge work.
    await expect(allocatePayment(tx, baseArgs)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('over-allocation accounts for prior allocations (60 used + 50 new on a 100 payment) → 409', async () => {
    const tx = txWith({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: 'pay-1', agencyId: 'a1', companyId: 'c1', amount: D(100), status: 'confirmed' },
        ]),
      paymentAllocation: {
        findMany: vi.fn().mockResolvedValue([{ chargeId: 'ch-0', amount: D(60) }]),
      },
    })
    await expect(
      allocatePayment(tx, {
        agencyId: 'a1',
        paymentId: 'pay-1',
        allocations: [{ chargeId: 'ch-1', amount: 50 }], // 60 + 50 > 100
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('explicit allocation amount must be positive → 400', async () => {
    const tx = txWith({
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: 'pay-1', agencyId: 'a1', companyId: 'c1', amount: D(100), status: 'confirmed' },
        ]),
      paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
    })
    await expect(
      allocatePayment(tx, {
        agencyId: 'a1',
        paymentId: 'pay-1',
        allocations: [{ chargeId: 'ch-1', amount: D(0) }],
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
