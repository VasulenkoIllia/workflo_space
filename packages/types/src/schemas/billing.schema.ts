import { z } from 'zod'

export const confirmPaymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(1000).optional(),
})
