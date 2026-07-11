import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** ANNOUNCEMENTS (07-В): sticky-банер + owner-адмінка зі % прочитань. */
export interface ActiveAnnouncement {
  id: string
  title: string
  body: string
  createdAt: string
}

export type AnnouncementAudience = 'team' | 'clients' | 'all'

export interface AdminAnnouncement {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  published: boolean
  archivedAt: string | null
  createdAt: string
  readCount: number
  targetCount: number
  readPct: number | null
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

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['announcements-admin'] })
  void qc.invalidateQueries({ queryKey: ['announcements-active'] })
}

export function useAnnouncementsAdmin() {
  return useQuery({
    queryKey: ['announcements-admin'],
    queryFn: () =>
      api
        .get<{ announcements: AdminAnnouncement[] }>('/workspace/announcements')
        .then((r) => r.announcements),
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; body: string; audience: AnnouncementAudience }) =>
      api.post('/workspace/announcements', body),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      title?: string
      body?: string
      audience?: AnnouncementAudience
      published?: boolean
      archived?: boolean
    }) => api.patch(`/workspace/announcements/${id}`, body),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/announcements/${id}`),
    onSuccess: () => invalidate(qc),
  })
}
