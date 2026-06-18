import { Prisma } from '@workflo/db'
import { describe, expect, it } from 'vitest'
import { type FxRates, toUsd } from '../src/services/currency.js'

/**
 * Shared USD normalization (P-8). USD identity, UAH ÷ usdToUah, EUR × eurToUah ÷ usdToUah,
 * unknown/missing-rate → as-is. Pure Decimal math — no DB.
 */
describe('toUsd (currency normalization)', () => {
  const D = (v: number | string) => new Prisma.Decimal(v)
  const rates: FxRates = { usdToUah: D(40), eurToUah: D(44) }

  it('USD is identity', () => {
    expect(toUsd(D(100), 'USD', rates).toFixed(2)).toBe('100.00')
  })

  it('UAH divides by usdToUah', () => {
    expect(toUsd(D(4000), 'UAH', rates).toFixed(2)).toBe('100.00') // 4000 / 40
  })

  it('EUR converts via eurToUah ÷ usdToUah', () => {
    expect(toUsd(D(100), 'EUR', rates).toFixed(2)).toBe('110.00') // 100 × 44 / 40
  })

  it('EUR with no eurToUah → counted as-is (best-effort report path)', () => {
    expect(toUsd(D(100), 'EUR', { usdToUah: D(40), eurToUah: null }).toFixed(2)).toBe('100.00')
  })

  it('UAH with no usdToUah → counted as-is', () => {
    expect(toUsd(D(4000), 'UAH', { usdToUah: null, eurToUah: D(44) }).toFixed(2)).toBe('4000.00')
  })

  it('unknown currency → counted as-is', () => {
    expect(toUsd(D(100), 'GBP', rates).toFixed(2)).toBe('100.00')
  })
})
