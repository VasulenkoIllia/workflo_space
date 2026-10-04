import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** ANNOUNCEMENTS (07-В): owner-адмінка зі % прочитань. Читацька сторона
 * (банер + active/read хуки) — @workflo/app-core (R5, аудит r6). */
export {
  AnnouncementBanner,
  useActiveAnnouncements,
  useReadAnnouncement,
  type ActiveAnnouncement,
} from '@workflo/app-core'

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
