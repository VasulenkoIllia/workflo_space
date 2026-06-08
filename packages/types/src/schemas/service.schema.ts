import { z } from 'zod'
import { ChargeFrequency } from '../enums.js'

/** Catalog/assignment prices are decimal currency amounts; ≥ 0 (a free tier is allowed), max 2dp. */
function hasTwoFractionDigits(value: number): boolean {
  return Math.round(value * 100) === value * 100
}

const priceAmount = z
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000_000)
  .refine(hasTwoFractionDigits, 'Price must have at most 2 decimal places')

/** POST /workspace/services — create a catalog service. */
export const createServiceSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  defaultPriceUsd: priceAmount.optional(),
  isRecurring: z.boolean().default(true),
})
export type CreateServiceInput = z.infer<typeof createServiceSchema>

/** PATCH /workspace/services/:id — partial catalog update. */
export const updateServiceSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).nullish(),
    defaultPriceUsd: priceAmount.nullish(),
    isActive: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

/** POST /workspace/services/:id/assign — subscribe a company at a per-client price. */
export const assignServiceSchema = z.object({
  companyId: z.string().uuid(),
  customPrice: priceAmount,
  frequency: z.nativeEnum(ChargeFrequency).default(ChargeFrequency.MONTHLY),
})
export type AssignServiceInput = z.infer<typeof assignServiceSchema>

/** PATCH /workspace/services/:id/companies/:companyId — change a subscription. */
export const updateAssignmentSchema = z
  .object({
    customPrice: priceAmount.optional(),
    frequency: z.nativeEnum(ChargeFrequency).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>

/** POST /workspace/billing/charges/generate — manual fallback for the recurring cron. */
export const generateChargesSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM'),
})
export type GenerateChargesInput = z.infer<typeof generateChargesSchema>
