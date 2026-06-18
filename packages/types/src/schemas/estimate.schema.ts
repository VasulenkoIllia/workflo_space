import { z } from 'zod'

/**
 * Estimate lines (02-Б, P-6) — a Project's budget positions (service × hours). Each line
 * auto-spawns a zeroBilled kanban task. Hours feed the `includedHoursCap` reconciliation;
 * `amount` is an optional line price in the project currency (null = zero-billed).
 */

const hours = z.number().finite().positive().max(100_000) // a budget position carries > 0 hours
const price = z.number().finite().nonnegative().max(1_000_000_000)

/** POST /workspace/projects/:id/estimate-lines */
export const createEstimateLineSchema = z.object({
  serviceId: z.string().uuid().nullish(),
  name: z.string().trim().min(1).max(300),
  hours: hours,
  amount: price.nullish(),
  position: z.number().int().min(0).max(10_000).optional(),
})
export type CreateEstimateLineInput = z.infer<typeof createEstimateLineSchema>

/** PATCH /workspace/projects/:id/estimate-lines/:lineId */
export const updateEstimateLineSchema = z
  .object({
    serviceId: z.string().uuid().nullish(),
    name: z.string().trim().min(1).max(300).optional(),
    hours: hours.optional(),
    amount: price.nullish(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateEstimateLineInput = z.infer<typeof updateEstimateLineSchema>
