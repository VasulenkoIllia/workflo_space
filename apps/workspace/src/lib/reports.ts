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

/** SLA-compliance (S11) — GET /workspace/reports/sla. Owner-only. */
export interface SlaSideStats {
  met: number
  late: number
  pending: number
  compliancePct: number | null
}
export interface SlaAssigneeRow {
  assigneeId: string | null
  name: string
  total: number
  firstResponse: SlaSideStats
  resolution: SlaSideStats
}
export interface SlaReport {
  from: string
  to: string
  total: number
  firstResponse: SlaSideStats
  resolution: SlaSideStats
  byAssignee: SlaAssigneeRow[]
  breachedOrders: {
    orderId: string
    title: string
    assigneeName: string | null
    kind: 'first_response' | 'resolution'
    dueAt: string
  }[]
}

export function useSlaReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-reports', 'sla', from, to],
    queryFn: () => api.get<SlaReport>(`/workspace/reports/sla?from=${from}&to=${to}`),
    enabled: enabled && from !== '' && to !== '',
  })
}

/** Джерела лідів (S11) — GET /workspace/reports/lead-sources. Owner-only. */
export interface LeadSourceRow {
  source: string
  kind: 'utm' | 'manual' | 'none'
  leads: number
  won: number
  lost: number
  converted: number
  conversionPct: number | null
  revenue: Record<string, number>
  paidRevenue: Record<string, number>
}
export interface LeadSourceReport {
  from: string
  to: string
  totalLeads: number
  rows: LeadSourceRow[]
  campaigns: { source: string; campaign: string; leads: number; won: number }[]
}

export function useLeadSourceReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-reports', 'lead-sources', from, to],
    queryFn: () =>
      api.get<LeadSourceReport>(`/workspace/reports/lead-sources?from=${from}&to=${to}`),
    enabled: enabled && from !== '' && to !== '',
  })
}
