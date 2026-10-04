import { Prisma } from '@workflo/db'
import { describe, expect, it } from 'vitest'
import { computeManualDiscount, postLoyaltyNet } from '../src/services/chargeDiscount.js'

/**
 * One-time manual discount math (P-10, 05-З). Pure Decimal — pct and/or flat amount off
 * the post-loyalty net, clamped to the net (never negative).
 */
describe('computeManualDiscount', () => {
  const D = (v: number | string) => new Prisma.Decimal(v)
  const net = D(100)

  it('percent off the net', () => {
    const r = computeManualDiscount(net, { pct: D(10), amount: null })
    expect(r.manualDiscountAmount.toFixed(2)).toBe('10.00')
    expect(r.totalAmount.toFixed(2)).toBe('90.00')
  })

  it('flat amount off the net', () => {
    const r = computeManualDiscount(net, { pct: null, amount: D(25) })
    expect(r.manualDiscountAmount.toFixed(2)).toBe('25.00')
    expect(r.totalAmount.toFixed(2)).toBe('75.00')
  })

  it('percent AND amount stack', () => {
    const r = computeManualDiscount(net, { pct: D(10), amount: D(25) })
    expect(r.manualDiscountAmount.toFixed(2)).toBe('35.00') // 10 + 25
    expect(r.totalAmount.toFixed(2)).toBe('65.00')
  })

  it('clamps to the net — a charge drops to 0, never negative', () => {
    const r = computeManualDiscount(net, { pct: null, amount: D(200) })
    expect(r.manualDiscountAmount.toFixed(2)).toBe('100.00')
    expect(r.totalAmount.toFixed(2)).toBe('0.00')
  })

  it('zero / null inputs → no discount', () => {
    const r = computeManualDiscount(net, { pct: D(0), amount: D(0) })
    expect(r.manualDiscountAmount.toFixed(2)).toBe('0.00')
    expect(r.totalAmount.toFixed(2)).toBe('100.00')
  })
})

describe('postLoyaltyNet', () => {
  const D = (v: number | string) => new Prisma.Decimal(v)

  it('= baseAmount − loyalty discountAmount (stable base, ignores prior total)', () => {
    expect(
      postLoyaltyNet({ baseAmount: D(100), amount: D(95), discountAmount: D(5) }).toFixed(2)
    ).toBe('95.00')
  })

  it('falls back to amount when baseAmount is null', () => {
    expect(
      postLoyaltyNet({ baseAmount: null, amount: D(80), discountAmount: null }).toFixed(2)
    ).toBe('80.00')
  })
})
