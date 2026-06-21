import { useQueries, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** One project's margin within a window (S5.6 P-9). */
export interface ProjectMargin {
  projectId: string
  projectName: string
  currency: string
  revenueUsd: string
  costUsd: string
  marginUsd: string
  marginPct: string
  paidUsd: string
  paidPct: string
  byExecutor: { executorId: string; hours: string; costUsd: string }[]
}

/** A client's rolled-up margin (all their projects). */
export interface ClientMargin {
  companyId: string
  revenueUsd: string
  costUsd: string
  marginUsd: string
  marginPct: string
  paidUsd: string
  paidPct: string
  projects: ProjectMargin[]
}

export function useClientMargin(companyId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['ws-margin', companyId, from, to],
    queryFn: () =>
      api.get<{ from: string; to: string; margin: ClientMargin }>(
        `/workspace/companies/${companyId}/margin?from=${from}&to=${to}`
      ),
    enabled: companyId !== '' && from !== '' && to !== '',
  })
}

export interface MarginCompanyRow {
  company: { id: string; name: string }
  margin: ClientMargin | undefined
}

/** Margin for EVERY client in one shot (useQueries) — the client margin already nests its
 * projects, so this single set powers both the by-clients and by-projects groupings. Shares the
 * `useClientMargin` cache key. N requests; fine for an owner analytics view. */
export function useAllClientMargins(
  companies: { id: string; name: string }[],
  from: string,
  to: string
) {
  const results = useQueries({
    queries: companies.map((c) => ({
      queryKey: ['ws-margin', c.id, from, to],
      queryFn: () =>
        api.get<{ from: string; to: string; margin: ClientMargin }>(
          `/workspace/companies/${c.id}/margin?from=${from}&to=${to}`
        ),
      enabled: from !== '' && to !== '',
    })),
  })
  const rows: MarginCompanyRow[] = companies.map((c, i) => ({
    company: c,
    margin: results[i]?.data?.margin,
  }))
  return { rows, isLoading: results.some((r) => r.isLoading) }
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
