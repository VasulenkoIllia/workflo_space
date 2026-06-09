import { z } from 'zod'
import { LoyaltyTier } from '../enums.js'

/**
 * POST /workspace/companies/:id/loyalty/override-discount (S5-09). Pin the company's
 * effective tier to `tier`, or pass `null` to clear the pin and let the nightly
 * recalc govern the earned tier again.
 */
export const loyaltyOverrideSchema = z
  .object({
    tier: z.nativeEnum(LoyaltyTier).nullable(),
  })
  .strict()
export type LoyaltyOverrideInput = z.infer<typeof loyaltyOverrideSchema>
