import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /portal/projects — the client's own financial projects (read-only, client-safe). */
export interface ClientProject {
  id: string
  name: string
  type: string | null
  billingModel: 'fixed_monthly_advance' | 'hourly_prepaid' | 'hourly_postpaid'
  currency: string
  abonAmount: string | null
  clientHourlyRate: string | null
  billingCycle: 'monthly_day_n' | 'weekly_day_x' | 'manual'
  includedHoursCap: string | null
  paymentTermsDays: number | null
  active: boolean
  createdAt: string
  /** DSN-5: наступне продовження циклу (null — ручний цикл) */
  nextCycleAt: string | null
  /** DSN-5: поточний білінг-цикл + години по замовленнях проєкту за нього */
  cycle: { from: string; to: string; hoursUsed: number }
}

export function usePortalProjects() {
  return useQuery({
    queryKey: ['portal-projects'],
    queryFn: () => api.get<{ projects: ClientProject[] }>('/portal/projects'),
  })
}

/** DSN-5: позиції кошторису проєкту — «що входить» у модалці деталей. */
export interface ProjectEstimateLine {
  id: string
  name: string
  hours: string
  amount: string | null
}

export function usePortalProjectEstimate(projectId: string | null) {
  return useQuery({
    queryKey: ['portal-project-estimate', projectId],
    queryFn: () =>
      api
        .get<{
          estimate: { lines: ProjectEstimateLine[]; totalHours: string }
        }>(`/portal/projects/${projectId}/estimate-lines`)
        .then((r) => r.estimate),
    enabled: projectId != null,
  })
}
