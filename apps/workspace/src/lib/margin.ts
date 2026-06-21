import { useQuery } from '@tanstack/react-query'
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

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
