import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** S11-01/02: глобальний FTS-пошук для Cmd+K. Результати скоупляться роллю на беку. */
export interface SearchResults {
  orders: { id: string; title: string; internalStatus: string }[]
  companies: { id: string; name: string }[]
  leads: { id: string; name: string; status: string }[]
  projects: { id: string; name: string }[]
}

export function useGlobalSearch(q: string) {
  const enabled = q.trim().length >= 2
  return useQuery({
    queryKey: ['global-search', q],
    queryFn: () => api.get<SearchResults>(`/workspace/search?q=${encodeURIComponent(q.trim())}`),
    enabled,
    staleTime: 15_000,
    // пошук — фонова підказка; помилку не тостимо (глобальний пайплайн)
    meta: { suppressGlobalToast: true },
  })
}
