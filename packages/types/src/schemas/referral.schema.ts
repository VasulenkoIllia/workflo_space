import { z } from 'zod'

/** One referral payout tier (matches the `ReferralTier` shape). */
export const referralTierSchema = z.object({
  minPaidUsd: z.number().finite().nonnegative().max(1_000_000_000),
  percent: z.number().finite().min(0).max(100),
})

/**
 * PATCH /admin/referral/settings — toggle the program, replace the tier table,
 * and/or set the employee-referral percent (P-9b, §4.2: flat % of a referred
 * client's net income). `tiers` is the full replacement list (not a merge); at
 * least one field must be present.
 */
export const updateReferralSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    tiers: z.array(referralTierSchema).max(20).optional(),
    employeeReferralPercent: z.number().finite().min(0).max(100).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Потрібно вказати хоча б одне поле' })
export type UpdateReferralSettingsInput = z.infer<typeof updateReferralSettingsSchema>
