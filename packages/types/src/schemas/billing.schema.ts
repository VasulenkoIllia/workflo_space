import { z } from 'zod'
import { PaymentType } from '../enums.js'

/**
 * Money inputs are decimal currency amounts (e.g. 4200.00), never minor units.
 * The 2-decimal refine is the single guard against fractional-cent drift entering
 * a balance — every amount field reuses it. Storage/arithmetic is Prisma.Decimal;
 * this only validates the inbound shape.
 */
function hasTwoFractionDigits(value: number): boolean {
  // toFixed avoids the float trap where e.g. 1.12*100 === 112.00000000000001 (rejects valid input).
  return Number(value.toFixed(2)) === value
}

export const moneyAmount = z
  .number()
  .finite()
  .positive()
  .max(1_000_000_000)
  .refine(hasTwoFractionDigits, 'Amount must have at most 2 decimal places')

/** Currencies the manual billing path can snapshot to USD (base). EUR/other → add an FX leg first. */
export const billingCurrency = z.enum(['USD', 'UAH'])

/** Legacy single-field confirm (kept for back-compat); the full create is `createPaymentSchema`. */
export const confirmPaymentSchema = z.object({
  amount: moneyAmount,
  note: z.string().max(1000).optional(),
})

/**
 * Body for `POST /workspace/billing/payments`. `companyId` is always required (the
 * payer); `orderId` settles a specific order (advance/final/partial). Idempotency is
 * carried by the `Idempotency-Key` header, NOT the body, so a retry replays the row.
 */
export const createPaymentSchema = z.object({
  companyId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  amount: moneyAmount,
  currency: billingCurrency.default('USD'),
  type: z.nativeEnum(PaymentType).default(PaymentType.FINAL),
  paymentMethod: z.string().max(100).optional(),
  paymentReference: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
})
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

/**
 * Body for `POST /workspace/billing/payments/:id/allocate` (S5-07). Either hand an
 * explicit list of `{chargeId, amount}` pairs, or omit `allocations` entirely to
 * auto-allocate the payment's unallocated remainder across the company's outstanding
 * charges FIFO by `dueDate`. Σ allocated can never exceed the payment amount — the
 * service enforces it under a payment row lock (→ 409 over-allocation).
 */
export const allocatePaymentSchema = z
  .object({
    allocations: z
      .array(z.object({ chargeId: z.string().uuid(), amount: moneyAmount }))
      .min(1)
      .max(100)
      .optional(),
  })
  .strict()
export type AllocatePaymentInput = z.infer<typeof allocatePaymentSchema>

/** `YYYY-MM` calendar month (charges/payments filter). */
export const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM')

export const billingListQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  month: monthString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type BillingListQuery = z.infer<typeof billingListQuerySchema>

/** PATCH `/workspace/settings/payment` — agency bank/crypto details shown to clients. */
export const updatePaymentSettingsSchema = z
  .object({
    bankName: z.string().max(200).nullish(),
    iban: z.string().max(64).nullish(),
    accountName: z.string().max(200).nullish(),
    cryptoUsdt: z.string().max(200).nullish(),
    notes: z.string().max(1000).nullish(),
    invoiceCurrency: billingCurrency.optional(),
  })
  .strict()
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>
