import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /workspace/settings/payment — agency bank/crypto details shown to clients. */
export interface PaymentSettings {
  bankName: string | null
  iban: string | null
  accountName: string | null
  cryptoUsdt: string | null
  notes: string | null
  invoiceCurrency: string | null
  paymentTermsDays: number | null
}

export interface PaymentSettingsInput {
  bankName?: string | null
  iban?: string | null
  accountName?: string | null
  cryptoUsdt?: string | null
  notes?: string | null
  invoiceCurrency?: string
  paymentTermsDays?: number | null
}

/** GET /admin/referral/settings — per-agency referral program config. */
export interface ReferralSettings {
  enabled: boolean
  tiers: { minPaidUsd: number; percent: number }[]
  employeeReferralPercent: number
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ['ws-settings', 'payment'],
    queryFn: () => api.get<{ settings: PaymentSettings | null }>('/workspace/settings/payment'),
  })
}

export function useSavePaymentSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PaymentSettingsInput) =>
      api.patch<{ settings: PaymentSettings }>('/workspace/settings/payment', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-settings', 'payment'] }),
  })
}

export function useReferralSettings() {
  return useQuery({
    queryKey: ['ws-settings', 'referral'],
    queryFn: () => api.get<ReferralSettings>('/admin/referral/settings'),
  })
}

export function useSaveReferralSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<ReferralSettings>) =>
      api.patch<ReferralSettings>('/admin/referral/settings', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-settings', 'referral'] }),
  })
}
