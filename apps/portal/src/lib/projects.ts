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
}

export function usePortalProjects() {
  return useQuery({
    queryKey: ['portal-projects'],
    queryFn: () => api.get<{ projects: ClientProject[] }>('/portal/projects'),
  })
}
