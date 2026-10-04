import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /portal/referral — the client's referral code + earnings + referred companies. */
export interface ReferralOverview {
  referralCode: string
  enabled: boolean
  totalEarned: string
  referrals: { id: string; name: string; totalEarned: string; since: string }[]
}

export function useReferral() {
  return useQuery({
    queryKey: ['portal-referral'],
    queryFn: () => api.get<ReferralOverview>('/portal/referral'),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
