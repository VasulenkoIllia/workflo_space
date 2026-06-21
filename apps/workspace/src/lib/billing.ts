import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /workspace/billing/overview — agency money dashboard snapshot. */
export interface BillingOverview {
  monthlyRevenueUsd: string
  totalRevenueUsd: string
  outstandingDebt: string
  topDebtors: { companyId: string; name: string; debt: string }[]
}

/** GET /workspace/billing/charges — agency charge (P-11 approval fields included). */
export interface WsCharge {
  id: string
  companyId: string
  projectId: string | null
  kind: string | null
  amount: string
  totalAmount: string | null
  approvedAmount: string | null
  currency: string
  month: string
  status: string
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  approvalComment: string | null
  approvalDecidedAt: string | null
  dueDate: string | null
  paidAt: string | null
}

export function useBillingOverview(enabled = true) {
  return useQuery({
    queryKey: ['ws-billing', 'overview'],
    queryFn: () => api.get<BillingOverview>('/workspace/billing/overview'),
    enabled,
  })
}

/** Agency charges; pass approvalStatus='pending' for the «на погодженні» queue. */
export function useWsCharges(approvalStatus?: 'pending' | 'approved' | 'rejected') {
  const qs = new URLSearchParams({ limit: '100' })
  if (approvalStatus) qs.set('approvalStatus', approvalStatus)
  return useQuery({
    queryKey: ['ws-billing', 'charges', approvalStatus ?? 'all'],
    queryFn: () => api.get<{ charges: WsCharge[] }>(`/workspace/billing/charges?${qs.toString()}`),
  })
}

export interface DecideChargeVars {
  id: string
  decision: 'approve' | 'reject'
  comment?: string
  approvedAmount?: number
}

/** Release response — the decided charge's mutable fields (normalized DTO, not a full row). */
export interface DecidedCharge {
  id: string
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  approvalComment: string | null
  approvalDecidedAt: string | null
  approvedAmount: string | null
  amount: string
  totalAmount: string | null
}

/** POST /workspace/billing/charges/:id/approval — internal release of a draft on_actuals charge. */
export function useReleaseCharge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: DecideChargeVars) =>
      api.post<{ charge: DecidedCharge }>(`/workspace/billing/charges/${id}/approval`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws-billing'] })
    },
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
