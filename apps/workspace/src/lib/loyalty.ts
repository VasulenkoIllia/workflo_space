import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoyaltyTier } from '@workflo/types'
import { api } from '@/lib/api'

export interface LoyaltyHistoryEntry {
  fromTier: LoyaltyTier
  toTier: LoyaltyTier
  reason: string
  createdAt: string
}

/** GET /workspace/companies/:id/loyalty (S5-09) — tier, lifetime progress, override, history. */
export interface CompanyLoyalty {
  earnedTier: LoyaltyTier
  /** Manual owner override; null = automatic (earned tier applies). */
  tierOverride: LoyaltyTier | null
  effectiveTier: LoyaltyTier
  discountPercent: number
  lifetimePaidUsd: string
  progress: {
    nextTier: LoyaltyTier | null
    nextThresholdUsd: number | null
    remainingUsd: string | null
  }
  history: LoyaltyHistoryEntry[]
}

export function useCompanyLoyalty(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-loyalty', companyId],
    queryFn: () => api.get<CompanyLoyalty>(`/workspace/companies/${companyId}/loyalty`),
    enabled: companyId !== '' && enabled,
  })
}

/** POST override (owner-only). `tier: null` clears the override → back to the earned tier. */
export function useSetLoyaltyOverride(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: LoyaltyTier | null) =>
      api.post(`/workspace/companies/${companyId}/loyalty/override-discount`, { tier }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-loyalty', companyId] }),
  })
}
