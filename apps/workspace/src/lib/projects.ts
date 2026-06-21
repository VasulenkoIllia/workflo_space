import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface FinProject {
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

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ projects: FinProject[] }>('/workspace/projects'),
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
}

export function useSaveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ProjectInput & { id?: string }) =>
      id
        ? api.patch<{ project: FinProject }>(`/workspace/projects/${id}`, body)
        : api.post<{ project: FinProject }>('/workspace/projects', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
