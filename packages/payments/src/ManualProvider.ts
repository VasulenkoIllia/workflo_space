import type { ConfirmPaymentInput, PaymentProvider } from './PaymentProvider.js'

export class ManualProvider implements PaymentProvider {
  confirmPayment(_input: ConfirmPaymentInput): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true })
  }
}
