import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Hours plan-vs-actual report (19, 12-ПЛАН-ФАКТ) — GET /workspace/reports/hours. Owner-only. */
export interface HoursReportOrderRow {
  orderId: string
  title: string
  projectName: string | null
  estimatedHours: number | null
  loggedHours: number
  variance: number | null
}
export interface HoursReportExecutorRow {
  executorId: string
  name: string
  loggedHours: number
  capacityHours: number
  utilizationPct: number | null
}
export interface HoursReport {
  from: string
  to: string
  byOrder: HoursReportOrderRow[]
  byExecutor: HoursReportExecutorRow[]
  totals: { estimatedHours: number; loggedHours: number; variance: number }
}

export function useHoursReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-reports', 'hours', from, to],
    queryFn: () => api.get<HoursReport>(`/workspace/reports/hours?from=${from}&to=${to}`),
    enabled: enabled && from !== '' && to !== '',
  })
}
