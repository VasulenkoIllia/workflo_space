import { describe, expect, it } from 'vitest'
import {
  ManualProvider,
  type ConfirmPaymentInput,
  type ConfirmPaymentResult,
  type CreatePaymentLinkInput,
  type PaymentProvider,
  type RefundInput,
} from '../src/index.js'

/**
 * A future hosted-checkout provider implementing the FULL optional surface. This
 * existing-and-compiling is the conformance check: if the interface drifts, this
 * stub stops satisfying `PaymentProvider` and the build/test breaks.
 */
class StubGatewayProvider implements PaymentProvider {
  readonly name = 'stub-gateway'

  async confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    return { ok: input.amount > 0, providerPaymentId: `pay_${input.idempotencyKey}` }
  }

  async createPaymentLink(input: CreatePaymentLinkInput) {
    return {
      url: `https://pay.example/${input.idempotencyKey}`,
      providerPaymentId: `pay_${input.idempotencyKey}`,
    }
  }

  async handleWebhook(_raw: unknown, _signature?: string) {
    return { providerPaymentId: 'pay_webhook', ok: true }
  }

  verifySignature(_raw: string, _signature: string): boolean {
    return true
  }

  async refund(input: RefundInput) {
    return { ok: input.amount > 0, refundId: `rf_${input.providerPaymentId}` }
  }
}

describe('PaymentProvider conformance (S5-01)', () => {
  it('ManualProvider satisfies the interface with only the required surface', () => {
    const provider: PaymentProvider = new ManualProvider()
    expect(provider.name).toBe('manual')
    expect(provider.createPaymentLink).toBeUndefined()
    expect(provider.refund).toBeUndefined()
  })

  it('a full gateway stub satisfies the interface with every optional method', async () => {
    const provider: PaymentProvider = new StubGatewayProvider()
    const link = await provider.createPaymentLink!({
      amount: 10,
      currency: 'USD',
      idempotencyKey: 'k',
    })
    expect(link.url).toContain('pay.example')
    expect(provider.verifySignature!('raw', 'sig')).toBe(true)
    const refund = await provider.refund!({ providerPaymentId: 'pay_1', amount: 5 })
    expect(refund.refundId).toBe('rf_pay_1')
  })
})
