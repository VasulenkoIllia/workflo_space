import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  metadata: unknown
  createdAt: string
}

export interface NotificationsResult {
  notifications: Notification[]
  meta: { hasMore: boolean; unreadCount: number }
}

/** In-app notification feed (07). Polled so the bell badge stays fresh without an SSE channel. */
export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => api.get<NotificationsResult>(`/notifications?limit=${limit}`),
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
