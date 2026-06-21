import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /portal/billing/summary — the client's all-in-one money snapshot. */
export interface PortalSummary {
  debt: string
  debtUah: string | null
  totalPaid: string
  loyaltyTier: 'new' | 'regular' | 'partner' | 'vip'
  discountPercent: number
  bonusBalance: string
  moneyBalance: string
  projects: {
    id: string
    name: string
    billingModel: string
    amount: string | null
    currency: string
    billingCycle: string
    nextCycleAt: string | null
  }[]
  paymentSettings: {
    bankName: string | null
    iban: string | null
    accountName: string | null
    cryptoUsdt: string | null
    notes: string | null
    invoiceCurrency: string | null
  } | null
}

/** GET /portal/billing/charges — one service charge (P-11 approval fields included). */
export interface PortalCharge {
  id: string
  projectId: string | null
  kind: string | null
  amount: string // quote (pre-counter-offer)
  totalAmount: string | null // final owed (lowered by a counter-offer)
  approvedAmount: string | null
  currency: string
  month: string // YYYY-MM
  status: string // pending|partial|paid|overdue|written_off (payment state)
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  approvalComment: string | null
  approvalDecidedAt: string | null
  dueDate: string | null
  paidAt: string | null
}

export interface PortalPayment {
  id: string
  amount: string
  currency: string
  amountUsd: string | null
  type: string
  status: string
  paymentMethod: string | null
  note: string | null
  confirmedAt: string
}

export function usePortalSummary() {
  return useQuery({
    queryKey: ['portal-billing', 'summary'],
    queryFn: () => api.get<PortalSummary>('/portal/billing/summary'),
  })
}

export function usePortalCharges() {
  return useQuery({
    queryKey: ['portal-billing', 'charges'],
    queryFn: () => api.get<{ charges: PortalCharge[] }>('/portal/billing/charges?limit=100'),
  })
}

export function usePortalPayments() {
  return useQuery({
    queryKey: ['portal-billing', 'payments'],
    queryFn: () => api.get<{ payments: PortalPayment[] }>('/portal/billing/payments?limit=50'),
  })
}

export interface DecideChargeVars {
  id: string
  decision: 'approve' | 'reject'
  comment?: string
  approvedAmount?: number
}

/** Approve/reject response — the decided charge's mutable fields (normalized DTO, not a full row). */
export interface DecidedCharge {
  id: string
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  approvalComment: string | null
  approvalDecidedAt: string | null
  approvedAmount: string | null
  amount: string
  totalAmount: string | null
}

/** POST /portal/charges/:id/approval — client releases / refuses a draft on_actuals charge. */
export function useDecideCharge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: DecideChargeVars) =>
      api.post<{ charge: DecidedCharge }>(`/portal/charges/${id}/approval`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-billing'] })
    },
  })
}

/** Number from a decimal-string DTO field (amounts arrive as fixed-2 strings). */
export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
