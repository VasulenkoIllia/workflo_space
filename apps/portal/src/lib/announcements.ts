import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** ANNOUNCEMENTS (07-В): sticky-банер оголошень агенції для клієнта (clients/all). */
export interface ActiveAnnouncement {
  id: string
  title: string
  body: string
  createdAt: string
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ['announcements-active'],
    queryFn: () =>
      api
        .get<{ announcements: ActiveAnnouncement[] }>('/announcements/active')
        .then((r) => r.announcements),
    staleTime: 60_000,
  })
}

export function useReadAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/read`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['announcements-active'] }),
  })
}
