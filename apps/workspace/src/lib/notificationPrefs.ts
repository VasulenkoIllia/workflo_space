import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type NotifCategory =
  | 'orders'
  | 'chat'
  | 'billing'
  | 'documents'
  | 'loyalty'
  | 'system'
  | 'auth'
export type NotifChannel = 'in_app' | 'email' | 'telegram'

export interface NotifPref {
  // Kept as string (not the narrow unions): the GET response may legitimately carry channels the
  // UI doesn't render (sms/push/webhook) without being a type-lie. The save direction builds rows
  // from the narrow NOTIF_CATEGORIES/NOTIF_CHANNELS constants, so it's already constrained there.
  category: string
  channel: string
  enabled: boolean
}

/** Rows of the matrix (display order + labels). */
export const NOTIF_CATEGORIES: { key: NotifCategory; label: string }[] = [
  { key: 'orders', label: 'Замовлення' },
  { key: 'chat', label: 'Чат і коментарі' },
  { key: 'billing', label: 'Рахунки й оплати' },
  { key: 'documents', label: 'Документи' },
  { key: 'loyalty', label: 'Бонуси' },
  { key: 'system', label: 'Система' },
  { key: 'auth', label: 'Безпека' },
]

/** Columns — the three live channels, in the design's order (sms/push/webhook are future). */
export const NOTIF_CHANNELS: { key: NotifChannel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'in_app', label: 'В застосунку' },
]

/** ADR-003: email for these categories is locked ON (critical security/billing events). */
export const LOCKED_EMAIL: ReadonlyArray<NotifCategory> = ['auth', 'billing']

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () =>
      api.get<{ preferences: NotifPref[] }>('/profile/notifications').then((r) => r.preferences),
  })
}

export function useSaveNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (preferences: NotifPref[]) => api.patch('/profile/notifications', { preferences }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  })
}

/** Build a `${category}:${channel}` → enabled lookup from the loaded rows. */
export function prefKey(category: string, channel: string): string {
  return `${category}:${channel}`
}
