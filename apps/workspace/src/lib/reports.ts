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

/** 19-А: виручка по місяцях/клієнтах + нові клієнти + дебіторка з віком. Owner-only. */
export interface RevenueReport {
  from: string
  to: string
  totalRevenueUsd: number
  totalPayments: number
  totalNewClients: number
  byMonth: { month: string; revenueUsd: number; payments: number; newClients: number }[]
  byClient: { companyId: string; name: string; revenueUsd: number; payments: number }[]
  debtors: { companyId: string; name: string; debt: Record<string, number>; oldestDays: number }[]
}

export function useRevenueReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['ws-reports', 'revenue', from, to],
    queryFn: () => api.get<RevenueReport>(`/workspace/reports/revenue?from=${from}&to=${to}`),
    enabled: enabled && from !== '' && to !== '',
  })
}

/** 19-Д: поточний місяць проти попереднього — дельта-чіпи owner-дашборда. */
export interface MomSide {
  revenueUsd: number
  ordersCreated: number
  leadsCreated: number
  hoursLogged: number
}
export interface MomReport {
  current: MomSide
  previous: MomSide
  pct: { [K in keyof MomSide]: number | null }
}

export function useMomReport(enabled = true) {
  return useQuery({
    queryKey: ['ws-reports', 'mom'],
    queryFn: () => api.get<MomReport>('/workspace/reports/mom'),
    enabled,
  })
}

/** S11-07: retention-аналітика клієнтської бази (life-time). Owner-only. */
export interface RetentionReport {
  totalCompanies: number
  tierCounts: { tier: string; count: number }[]
  repeatRatePct: string
  companiesWithOrders: number
  companiesWithRepeat: number
  medianDaysToSecondOrder: number | null
  newToRegularPct: string
  matureCompanies: number
  convertedCompanies: number
  activity: { active: number; atRisk: number; churned: number }
  atRiskClients: {
    id: string
    name: string
    lastActivityAt: string
    daysSince: number
    lifetimeUsd: string
    tier: string
  }[]
}

export function useRetentionReport() {
  return useQuery({
    queryKey: ['ws-reports', 'retention'],
    queryFn: () => api.get<RetentionReport>('/workspace/reports/retention'),
  })
}

// ── DSN-2: три нові зрізи 6-таб хабу звітів ──────────────────────────────────
export interface DepartmentReportRow {
  teamId: string
  name: string
  color: string | null
  leadName: string | null
  members: number
  hours: number
  tasksDone: number
  tasksActive: number
  avgCycleDays: number | null
  utilizationPct: number | null
}

export function useDepartmentsReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['report-departments', from, to],
    queryFn: () =>
      api.get<{ departments: DepartmentReportRow[] }>(
        `/workspace/reports/departments?from=${from}&to=${to}`
      ),
    enabled,
  })
}

export interface TimesheetEntry {
  id: string
  date: string
  hours: number
  comment: string | null
  executorId: string
  executorName: string
  orderId: string
  orderTitle: string
  companyName: string | null
}

export function useTimesheetReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['report-timesheet', from, to],
    queryFn: () =>
      api.get<{ entries: TimesheetEntry[] }>(`/workspace/reports/timesheet?from=${from}&to=${to}`),
    enabled,
  })
}

export interface AuditEvent {
  id: string
  createdAt: string
  action: string
  resourceType: string | null
  resourceId: string | null
  result: string
  metadata: Record<string, unknown> | null
  actorName: string
  isSystem: boolean
}

export function useAuditReport(enabled = true) {
  return useQuery({
    queryKey: ['report-audit'],
    queryFn: () =>
      api.get<{ events: AuditEvent[]; counts: { total: number; user: number; system: number } }>(
        '/workspace/reports/audit'
      ),
    enabled,
  })
}
