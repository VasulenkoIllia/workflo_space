import { z } from 'zod'

function hasTwoFractionDigits(value: number): boolean {
  return Math.round(value * 100) === value * 100
}

export const confirmPaymentSchema = z.object({
  amount: z
    .number()
    .finite()
    .positive()
    .max(1_000_000_000)
    .refine(hasTwoFractionDigits, 'Amount must have at most 2 decimal places'),
  note: z.string().max(1000).optional(),
})
