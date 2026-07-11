import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
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
  laborHourlyUsd: string
  incomeTaxUsd: string // S13-06: податок з доходу per-юр-особа (входить у витрати)
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

export interface MonthlyPnlPoint {
  month: string // YYYY-MM
  from: string
  to: string
  data: Pnl | undefined
}

/** The last `n` whole months (oldest→newest); current month bounded to today. */
function monthsBack(n: number): { month: string; from: string; to: string }[] {
  const now = new Date()
  const out: { month: string; from: string; to: string }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const last = i === 0 ? now : new Date(y, m + 1, 0)
    out.push({
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      from: isoDay(new Date(y, m, 1)),
      to: isoDay(last),
    })
  }
  return out
}

/** P&L for each of the last `n` months — drives the trend chart + monthly P&L table. Shares the
 * `usePnl` cache key so the current-month point is deduped with the overview query. */
export function useMonthlyPnl(n = 6, enabled = true) {
  const months = monthsBack(n)
  const results = useQueries({
    queries: months.map((m) => ({
      queryKey: ['ws-finance', 'pnl', m.from, m.to],
      queryFn: () => api.get<Pnl>(`/workspace/reports/pnl?from=${m.from}&to=${m.to}`),
      enabled,
    })),
  })
  const points: MonthlyPnlPoint[] = months.map((m, i) => ({ ...m, data: results[i]?.data }))
  return { points, isLoading: results.some((r) => r.isLoading) }
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
