import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /portal/wallet — the client's two balances (bonus ledger + money/AR account). */
export interface WalletBalances {
  bonusBalance: string
  moneyBalance: string
  currency: string
}

export type WalletTxnType = 'credit' | 'debit'

/** One wallet ledger row (bonus account). */
export interface WalletTxn {
  id: string
  type: WalletTxnType
  source: string // referral_bonus | manual_adjustment | invoice_payment | refund
  amount: string
  balanceAfter: string
  currency: string
  sourceId: string | null
  note: string | null
  createdAt: string
}

/** GET /portal/wallet/statement — merged money+bonus timeline. */
export interface WalletStatement {
  bonus: { balance: string }
  money: { balance: string; status: 'prepaid' | 'owing' | 'settled' }
  timeline: {
    kind: 'charge' | 'payment' | 'bonus'
    date: string
    amount: string
    detail: Record<string, unknown>
  }[]
}

export function useWallet() {
  return useQuery({
    queryKey: ['portal-wallet', 'balances'],
    queryFn: () => api.get<WalletBalances>('/portal/wallet'),
  })
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ['portal-wallet', 'transactions'],
    queryFn: () =>
      api.get<{
        transactions: WalletTxn[]
        pagination: { page: number; limit: number; total: number }
      }>('/portal/wallet/transactions?limit=50'),
  })
}

export function useWalletStatement() {
  return useQuery({
    queryKey: ['portal-wallet', 'statement'],
    queryFn: () => api.get<WalletStatement>('/portal/wallet/statement'),
  })
}

/** Number from a decimal-string DTO field (amounts arrive as fixed-2 strings). */
export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
