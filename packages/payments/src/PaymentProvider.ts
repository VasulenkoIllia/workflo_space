export interface ConfirmPaymentInput {
  amount: number
  note?: string
}

export interface PaymentProvider {
  confirmPayment(input: ConfirmPaymentInput): Promise<{ ok: boolean }>
}
