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

/**
 * Regression: the "Нова витрата" form sends `null` for a cleared optional field
 * (`vendor.trim() || null`, `endDate || null`). createExpenseSchema used `.optional()`
 * (string | undefined), so every expense left with a blank end-date or vendor 400'd
 * — the whole add-expense flow was broken. Now `.nullish()`, matching updateExpenseSchema.
 */
describe('createExpenseSchema accepts null for cleared optional fields', () => {
  const base = {
    type: 'recurring',
    category: 'software',
    amount: 10,
    currency: 'USD',
    frequency: 'monthly',
    startDate: '2026-06-24',
  }

  it('accepts null endDate (blank optional end date)', () => {
    expect(createExpenseSchema.safeParse({ ...base, endDate: null }).success).toBe(true)
  })

  it('accepts null vendor (blank supplier)', () => {
    expect(createExpenseSchema.safeParse({ ...base, vendor: null }).success).toBe(true)
  })

  it('still accepts the fully-filled payload', () => {
    const r = createExpenseSchema.safeParse({
      ...base,
      vendor: 'Acme',
      endDate: '2026-12-31',
    })
    expect(r.success).toBe(true)
  })

  it('still rejects a malformed date', () => {
    expect(createExpenseSchema.safeParse({ ...base, startDate: '24.06.2026' }).success).toBe(false)
  })
})
