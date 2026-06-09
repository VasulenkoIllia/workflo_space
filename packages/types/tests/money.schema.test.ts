import { describe, expect, it } from 'vitest'
import { createPaymentSchema } from '../src/schemas/billing.schema.js'
import { createExpenseSchema } from '../src/schemas/expense.schema.js'

/**
 * Regression guard for the 2-decimal money refine. The old predicate
 * `Math.round(value*100) === value*100` REJECTED valid amounts like 1.12 / 2.01 /
 * 16.01 (because `1.12*100 === 112.00000000000001`). The fix uses `toFixed`.
 */
const COMPANY = '22222222-2222-4222-8222-222222222222'

describe('money 2-decimal refine accepts float-trap amounts', () => {
  it.each([1.12, 2.01, 16.01, 64.01, 0.07, 99.99, 250, 1000.5])('accepts %s', (amount) => {
    const r = createPaymentSchema.safeParse({ companyId: COMPANY, amount })
    expect(r.success).toBe(true)
  })

  it.each([1.123, 10.125, 0.001])('rejects %s (more than 2 decimals)', (amount) => {
    const r = createPaymentSchema.safeParse({ companyId: COMPANY, amount })
    expect(r.success).toBe(false)
  })

  it('the expense schema shares the same fixed refine', () => {
    const ok = createExpenseSchema.safeParse({
      type: 'one_time',
      category: 'other',
      amount: 16.01,
      startDate: '2026-06-01',
    })
    expect(ok.success).toBe(true)
  })
})
