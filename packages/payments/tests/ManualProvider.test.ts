import { describe, expect, it } from 'vitest'
import { ManualProvider, type ConfirmPaymentInput } from '../src/index.js'

const base: ConfirmPaymentInput = { amount: 4200, currency: 'USD', idempotencyKey: 'idem-1' }

describe('ManualProvider (S5-01)', () => {
  it('confirms a valid payment with a null providerPaymentId', async () => {
    const provider = new ManualProvider()
    await expect(provider.confirmPayment(base)).resolves.toEqual({
      ok: true,
      providerPaymentId: null,
    })
  })

  it('exposes the stable provider name "manual"', () => {
    expect(new ManualProvider().name).toBe('manual')
  })

  it.each([0, -1, -0.01, Number.NaN])('rejects non-positive amount %p', async (amount) => {
    const provider = new ManualProvider()
    await expect(provider.confirmPayment({ ...base, amount })).rejects.toThrow(/positive/)
  })
})
