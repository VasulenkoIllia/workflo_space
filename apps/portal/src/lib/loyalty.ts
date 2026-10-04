import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type LoyaltyTier = 'new' | 'regular' | 'partner' | 'vip'

/** GET /loyalty/tiers — the public tier ladder (thresholds + discounts). */
export interface LoyaltyTierRow {
  tier: LoyaltyTier
  thresholdUsd: number
  discountPercent: number
}

export function useLoyaltyTiers() {
  return useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: () => api.get<{ tiers: LoyaltyTierRow[] }>('/loyalty/tiers'),
    staleTime: 5 * 60_000, // static ladder — cache generously
  })
}
