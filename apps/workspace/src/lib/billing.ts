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
  baseAmount: string | null
  manualDiscountPct: string | null
  manualDiscountAmount: string | null
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

export interface ApplyDiscountVars {
  id: string
  discountPct?: number
  discountAmount?: number
  reason?: string
}

/**
 * POST /workspace/billing/charges/:id/discount (P-10, 05-З) — owner-only one-time
 * manual discount on top of loyalty. At least one of pct/amount must be set.
 */
export function useApplyDiscount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ApplyDiscountVars) =>
      api.post<{ charge: WsCharge }>(`/workspace/billing/charges/${id}/discount`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws-billing'] })
    },
  })
}

/** GET /workspace/billing/payments — agency-wide payment history. */
export interface WsPayment {
  id: string
  companyId: string
  orderId: string | null
  amount: string
  currency: string
  amountUsd: string | null
  type: string
  status: string
  paymentMethod: string | null
  note: string | null
  confirmedAt: string
}

export function useWsPayments() {
  return useQuery({
    queryKey: ['ws-billing', 'payments'],
    queryFn: () => api.get<{ payments: WsPayment[] }>('/workspace/billing/payments?limit=100'),
  })
}

/** Body for POST /workspace/billing/payments (manual confirm). Mirrors `createPaymentSchema`. */
export interface CreatePaymentVars {
  companyId: string
  orderId?: string
  amount: number
  currency: string
  type: 'advance' | 'final' | 'partial'
  paymentMethod?: string
  paymentReference?: string
  note?: string
}

/** Fresh idempotency key per submit; mutations don't auto-retry, so one submit = one key. */
function freshKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return `pay-${c.randomUUID()}`
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * POST /workspace/billing/payments — operator records a confirmed manual payment.
 * Idempotent server-side via the `Idempotency-Key` header (8–200 chars).
 */
export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: CreatePaymentVars) =>
      api.post<{ payment: { id: string } }>('/workspace/billing/payments', vars, {
        headers: { 'Idempotency-Key': freshKey() },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws-billing'] })
    },
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
