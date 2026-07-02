import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type PayoutStatus = 'draft' | 'approved' | 'paid'

/** GET /workspace/team/payouts — one executor payout for a period. */
export interface Payout {
  id: string
  executorId: string
  period: string
  baseSalary: string
  billableHours: string
  hourlyEarned: string
  commissionAmount: string
  referralBonusAmount: string
  total: string
  currency: string
  status: PayoutStatus
  approvedBy: string | null
  paidAt: string | null
}

export interface TeamRate {
  monthlySalary: string | null
  commissionPercent: string
  currency: string
  /** «без собівартості» (22/P-5): весь дохід проєктів людини = дохід агенції. */
  zeroCostDefault: boolean
}

/** GET /workspace/team — roster with each member's current rate (rate null unless owner). */
export interface TeamMember {
  profileId: string
  role: string
  name: string
  email: string
  joinedAt: string
  /** weekly capacity norm (12-ПЛАН-ФАКТ); null → agency default in the hours report. */
  weeklyCapacityHours: number | null
  rate: TeamRate | null
}

export interface RateInput {
  executorId: string
  monthlySalary?: number
  commissionPercent?: number
  currency?: string
  hireDate?: string
}

export function useTeam() {
  return useQuery({
    queryKey: ['ws-team', 'roster'],
    queryFn: () => api.get<{ members: TeamMember[] }>('/workspace/team'),
  })
}

export function usePayouts(period: string) {
  return useQuery({
    queryKey: ['ws-payouts', period],
    queryFn: () => api.get<{ payouts: Payout[] }>(`/workspace/team/payouts?period=${period}`),
    enabled: period !== '',
  })
}

export function useGeneratePayouts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (period: string) =>
      api.post<{ payouts: Payout[] }>('/workspace/team/payouts/generate', { period }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-payouts'] }),
  })
}

export function usePayoutTransition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'mark-paid' }) =>
      api.post<{ payout: Payout }>(`/workspace/team/payouts/${id}/${action}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-payouts'] }),
  })
}

export function useSetRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ executorId, ...body }: RateInput) =>
      api.post(`/workspace/executors/${executorId}/rates`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-team'] }),
  })
}

/**
 * PATCH «без собівартості» (owner-only, 22/P-5). Server-side this closes the open
 * ExecutorRate window and opens a new one with the flag — compensation values carry over.
 */
export function useSetZeroCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, zeroCostDefault }: { profileId: string; zeroCostDefault: boolean }) =>
      api.patch(`/workspace/executors/${profileId}/zero-cost`, { zeroCostDefault }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-team'] }),
  })
}

/** PATCH a member's weekly capacity norm (owner-only, 12-ПЛАН-ФАКТ). */
export function useSetCapacity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      profileId,
      weeklyCapacityHours,
    }: {
      profileId: string
      weeklyCapacityHours: number | null
    }) => api.patch(`/workspace/executors/${profileId}/capacity`, { weeklyCapacityHours }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-team'] }),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
