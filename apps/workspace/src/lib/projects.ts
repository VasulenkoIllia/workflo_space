import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface FinProject {
  // TEAM-ADMIN-1: команда-виконавець проекту (клієнту не віддається)
  teamId?: string | null
  team?: { id: string; name: string } | null
  id: string
  companyId: string
  name: string
  type: string | null
  billingModel: 'fixed_monthly_advance' | 'hourly_prepaid' | 'hourly_postpaid'
  currency: string
  abonAmount: string | null
  clientHourlyRate: string | null
  billingCycle: 'monthly_day_n' | 'weekly_day_x' | 'manual'
  cycleDay: number | null
  cycleWeekday: number | null
  nextCycleAt: string | null
  paymentTermsDays: number | null
  legalEntityId: string | null
  contractRequired: boolean
  contractDocumentId: string | null
  requiresApproval: boolean | null
  advanceGatePct: string | null
  includedHoursCap: string | null
  approvalMode: 'none' | 'upfront' | 'on_actuals' | null
  invoiceApprover: 'client' | 'internal' | null
  active: boolean
  createdAt: string
}

export interface CompanyOption {
  id: string
  name: string
  slug: string
  loyaltyTier: string
  currency: string
}

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ projects: FinProject[] }>('/workspace/projects'),
    enabled,
  })
}

/** Project estimate (02-Б, P-6): spec lines + reconciliation vs the subscription hour cap. */
export interface EstimateLine {
  id: string
  serviceId: string | null
  name: string
  hours: string
  amount: string | null
  orderId: string | null
  position: number
}
export interface EstimateSummary {
  lines: EstimateLine[]
  totalHours: string
  includedHoursCap: string | null
  withinCap: boolean
  remainingHours: string | null
}

/** GET /workspace/projects/:id/estimate-lines — the project's spec. Internal-non-manager
 * + billing module on the backend → gate the query with `enabled`. */
export function useProjectEstimate(projectId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['project-estimate', projectId],
    queryFn: () =>
      api
        .get<{ estimate: EstimateSummary }>(`/workspace/projects/${projectId}/estimate-lines`)
        .then((r) => r.estimate),
    enabled: !!projectId && enabled,
  })
}

/** Projects for one client (company) — backend filters by `companyId` query. */
export function useCompanyProjects(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['projects', 'by-company', companyId],
    queryFn: () =>
      api.get<{ projects: FinProject[] }>(
        `/workspace/projects?companyId=${encodeURIComponent(companyId)}`
      ),
    enabled: companyId !== '' && enabled,
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get<{ companies: CompanyOption[] }>('/workspace/companies'),
  })
}

/** Create/update payload — only the fields the form sets. Decimals go as numbers. */
export interface ProjectInput {
  companyId?: string
  name: string
  type?: string | null
  billingModel?: FinProject['billingModel']
  currency?: string
  abonAmount?: number | null
  clientHourlyRate?: number | null
  billingCycle?: FinProject['billingCycle']
  cycleDay?: number | null
  cycleWeekday?: number | null
  approvalMode?: FinProject['approvalMode']
  invoiceApprover?: FinProject['invoiceApprover']
  contractRequired?: boolean
  paymentTermsDays?: number | null
  includedHoursCap?: number | null
  legalEntityId?: string | null
}

export function useSaveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ProjectInput & { id?: string }) =>
      id
        ? api.patch<{ project: FinProject }>(`/workspace/projects/${id}`, body)
        : api.post<{ project: FinProject }>('/workspace/projects', body),
    // invalidating ['projects'] also matches ['projects', id] (prefix) → detail refetches.
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

/** GET /workspace/projects/:id — single project for the detail screen. */
export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<{ project: FinProject }>(`/workspace/projects/${id}`),
    enabled: id !== '',
  })
}

/** PATCH only the project's legal entity (20-Д selector). null → inherit agency default. */
/** TEAM-ADMIN-1: призначити команду-виконавця проекту (null = зняти). */
export function useSetProjectTeam(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string | null) =>
      api.patch<{ project: FinProject }>(`/workspace/projects/${id}`, { teamId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fin-projects'] }),
  })
}

export function useSetProjectLegalEntity(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (legalEntityId: string | null) =>
      api.patch<{ project: FinProject }>(`/workspace/projects/${id}`, { legalEntityId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

/** POST /workspace/projects/:id/close-cycle — manual cycle close for a period. */
export function useCloseCycle(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { periodStart: string; periodEnd: string }) =>
      api.post<{ created: number }>(`/workspace/projects/${id}/close-cycle`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
