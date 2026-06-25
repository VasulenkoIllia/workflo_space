import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IconName } from '@workflo/ui'
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

// ── Inbox presentation (FE-3) — derive a «kind» from the event type for the row chip/glyph ──
export type NotifKind = 'order' | 'chat' | 'payment' | 'doc' | 'marketing' | 'system'

export function notifKind(type: string): NotifKind {
  if (type.startsWith('orders')) return 'order'
  if (type.startsWith('chat')) return 'chat'
  if (type.startsWith('billing')) return 'payment'
  if (type.startsWith('documents')) return 'doc'
  if (type.startsWith('loyalty')) return 'marketing'
  return 'system'
}

export const KIND_LABEL: Record<NotifKind, string> = {
  order: 'замовлення',
  chat: 'коментар',
  payment: 'оплата',
  doc: 'документ',
  marketing: 'бонус',
  system: 'система',
}

export const KIND_ICON: Record<NotifKind, IconName> = {
  order: 'inbox',
  chat: 'edit',
  payment: 'receipt',
  doc: 'file',
  marketing: 'gift',
  system: 'bell',
}

/** The «система» filter groups non-actionable feed items (system + marketing/loyalty). */
export function isSystemKind(type: string): boolean {
  const k = notifKind(type)
  return k === 'system' || k === 'marketing'
}

/** Extract a navigable order id from the notification metadata (vars carry orderUrl/invoiceUrl). */
export function notifLinkId(metadata: unknown): string | null {
  const m = metadata as { orderUrl?: string; invoiceUrl?: string } | null
  const url = m?.orderUrl || m?.invoiceUrl
  if (!url) return null
  const base = url.split('?')[0] ?? url
  const seg = base.split('/').filter(Boolean).pop()
  return seg && /^[0-9a-f-]{8,}$/i.test(seg) ? seg : null
}
