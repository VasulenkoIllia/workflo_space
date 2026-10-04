import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IconName } from '@workflo/ui'
import { api } from './api.js'

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  metadata: unknown
  /** 18-Б: приспано до цього часу (у майбутньому → показуємо 💤). */
  snoozedUntil?: string | null
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

/** Повернути в непрочитані (детальна панель інбокса). */
export function useMarkNotificationUnread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/unread`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/** Snooze (18-Б): сховати з непрочитаних і повернути непрочитаною через N годин. */
export function useSnoozeNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; hours: number }) =>
      api.post(`/notifications/${input.id}/snooze`, { hours: input.hours }),
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

/** Таб «@згадки» (канон 18-D mentioned-me): персональні згадки з чату. */
export function isMentionType(type: string): boolean {
  return type === 'chat.mentioned'
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
