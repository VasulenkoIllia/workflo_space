import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type ExpenseType = 'recurring' | 'one_time'
export type ExpenseCategory =
  | 'infrastructure'
  | 'software'
  | 'salary'
  | 'contractor'
  | 'rent'
  | 'tax'
  | 'marketing'
  | 'other'
export type ExpenseFrequency = 'monthly' | 'quarterly' | 'annual' | 'one_time'

/** GET /workspace/expenses — one operator-entered cost row. */
export interface Expense {
  id: string
  type: ExpenseType
  category: ExpenseCategory
  source: string
  vendor: string | null
  amount: string
  currency: string
  frequency: ExpenseFrequency | null
  startDate: string
  endDate: string | null
  executorId: string | null
  isActive: boolean
  createdAt: string
}

/** GET /workspace/reports/pnl — profit & loss for a date window. */
export interface Pnl {
  from: string
  to: string
  revenueUsd: string
  expensesUsd: string
  salaryUsd: string
  netProfitUsd: string
  marginPct: string
  byCategory: { category: string; amountUsd: string }[]
}

export interface ExpenseInput {
  type?: ExpenseType
  category: ExpenseCategory
  vendor?: string | null
  amount: number
  currency?: string
  frequency?: ExpenseFrequency | null
  startDate?: string
  endDate?: string | null
}

export function usePnl(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-finance', 'pnl', from, to],
    queryFn: () => api.get<Pnl>(`/workspace/reports/pnl?from=${from}&to=${to}`),
    enabled: enabled && from !== '' && to !== '',
  })
}

export function useExpenses() {
  return useQuery({
    queryKey: ['ws-finance', 'expenses'],
    queryFn: () => api.get<{ expenses: Expense[] }>('/workspace/expenses'),
  })
}

export function useSaveExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ExpenseInput & { id?: string }) =>
      id
        ? api.put<{ expense: Expense }>(`/workspace/expenses/${id}`, body)
        : api.post<{ expense: Expense }>('/workspace/expenses', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-finance'] }),
  })
}

export function useArchiveExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<{ expense: Expense }>(`/workspace/expenses/${id}/archive`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-finance'] }),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}

/** Local YYYY-MM-DD (no UTC shift) for date inputs. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
