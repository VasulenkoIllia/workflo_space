import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  PaymentProvider,
} from './PaymentProvider.js'

/**
 * The MVP provider: an operator records a payment they already received
 * out-of-band (bank transfer, cash). There is no external gateway, so
 * `providerPaymentId` is always `null` — idempotency is enforced by the API
 * layer's Idempotency-Key, not a gateway id. No money mutation happens here.
 */
export class ManualProvider implements PaymentProvider {
  readonly name = 'manual'

  confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    // Defense-in-depth: the API validates with Zod first, but never trust the
    // caller — a non-positive/NaN amount must never produce a "confirmed" result.
    if (!(input.amount > 0)) {
      return Promise.reject(new Error('ManualProvider: amount must be a positive number'))
    }
    return Promise.resolve({ ok: true, providerPaymentId: null })
  }
}
