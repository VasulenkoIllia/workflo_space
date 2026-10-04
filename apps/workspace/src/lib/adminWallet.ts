import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /admin/wallet/companies — agency client balances. */
export interface WalletCompany {
  id: string
  name: string
  bonusBalance: string
  moneyBalance: string
  currency: string
}

export interface AdminWalletTxn {
  id: string
  type: 'credit' | 'debit'
  source: string
  amount: string
  balanceAfter: string
  currency: string
  sourceId: string | null
  note: string | null
  createdAt: string
}

export interface AdjustInput {
  companyId: string
  type: 'credit' | 'debit'
  amount: number
  note: string
}

export function useWalletCompanies(search: string) {
  const qs = new URLSearchParams({ limit: '100' })
  if (search.trim()) qs.set('search', search.trim())
  return useQuery({
    queryKey: ['ws-admin-wallet', 'companies', search.trim()],
    queryFn: () =>
      api.get<{
        companies: WalletCompany[]
        pagination: { page: number; limit: number; total: number }
      }>(`/admin/wallet/companies?${qs.toString()}`),
  })
}

export function useCompanyWalletTxns(companyId: string | null) {
  return useQuery({
    queryKey: ['ws-admin-wallet', 'transactions', companyId],
    queryFn: () =>
      api.get<{ transactions: AdminWalletTxn[] }>(
        `/admin/wallet/companies/${companyId}/transactions?limit=50`
      ),
    enabled: companyId != null,
  })
}

export function useAdjustWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, ...body }: AdjustInput) =>
      api.post(`/admin/wallet/companies/${companyId}/adjust`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-admin-wallet'] }),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
