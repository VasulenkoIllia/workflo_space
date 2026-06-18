import { z } from 'zod'

function hasTwoFractionDigits(value: number): boolean {
  // toFixed avoids the float trap where e.g. 1.12*100 === 112.00000000000001 (rejects valid input).
  return Number(value.toFixed(2)) === value
}
const money = z
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000_000)
  .refine(hasTwoFractionDigits, 'At most 2 decimal places')

/** `YYYY-MM` payout period. */
export const periodString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM')

/**
 * POST /workspace/executors/:id/rates (S5-04). Append-only — each POST opens a NEW
 * rate window (the previous open window is closed), never an in-place edit. At least
 * one compensation field is required.
 */
export const createExecutorRateSchema = z
  .object({
    monthlySalary: money.nullish(),
    commissionPercent: z.number().finite().min(0).max(100).optional(),
    currency: z.enum(['USD', 'UAH', 'EUR']).optional(),
    hireDate: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
      .optional(),
  })
  .strict()
  .refine((d) => d.monthlySalary != null || d.commissionPercent != null, {
    message: 'Потрібна ставка або комісія',
  })
export type CreateExecutorRateInput = z.infer<typeof createExecutorRateSchema>

/** POST /workspace/team/payouts/generate — one executor or the whole team for a period. */
export const generatePayoutSchema = z.object({
  period: periodString,
  executorId: z.string().uuid().optional(),
})
export type GeneratePayoutInput = z.infer<typeof generatePayoutSchema>

/** GET /workspace/team/payouts — list by period. */
export const payoutQuerySchema = z.object({
  period: periodString.optional(),
})
export type PayoutQuery = z.infer<typeof payoutQuerySchema>
