/**
 * Currency-agnostic input for confirming a single payment.
 *
 * `idempotencyKey` anchors a provider call to one logical payment so a retry or
 * double-submit is replay-safe at the API layer (the DB-backed idempotency table
 * lives in apps/api). `amount` is in `currency`'s minor-unit-agnostic decimal form
 * (e.g. 4200.00) — the API validates 2-decimal precision via Zod before calling.
 */
export interface ConfirmPaymentInput {
  amount: number
  currency: string
  idempotencyKey: string
  /** Optional external reference (e.g. a bank transaction id for a manual record). */
  externalRef?: string
  note?: string
}

export interface ConfirmPaymentResult {
  ok: boolean
  /**
   * Provider-side payment id. `null` for {@link ManualProvider} — manual rows
   * intentionally allow a NULL `providerPaymentId`; their idempotency anchor is
   * the API-layer Idempotency-Key, not a provider id.
   */
  providerPaymentId: string | null
}

export interface CreatePaymentLinkInput {
  amount: number
  currency: string
  idempotencyKey: string
  returnUrl?: string
}

export interface RefundInput {
  providerPaymentId: string
  amount: number
}

/**
 * The seam every payment backend implements. Manual (the MVP provider) is the
 * only required surface; hosted-checkout providers (Monobank/Stripe/WayForPay,
 * S14) add the optional methods. Implementations MUST be free of money mutation —
 * persistence and ledger writes happen in apps/api inside a tenant transaction.
 */
export interface PaymentProvider {
  /** Stable machine name stamped onto `Payment.provider` (e.g. 'manual'). */
  readonly name: string

  confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>

  /** Hosted-checkout providers only: create a redirect/payment link. */
  createPaymentLink?(
    input: CreatePaymentLinkInput
  ): Promise<{ url: string; providerPaymentId: string }>

  /** Verify + parse an inbound provider webhook into a normalized result. */
  handleWebhook?(
    raw: unknown,
    signature?: string
  ): Promise<{ providerPaymentId: string; ok: boolean }>

  /** Signature verification for webhooks (HMAC / public-key, provider-specific). */
  verifySignature?(raw: string, signature: string): boolean

  refund?(input: RefundInput): Promise<{ ok: boolean; refundId: string | null }>
}
