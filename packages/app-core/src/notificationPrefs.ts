import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.js'

export type NotifCategory =
  | 'orders'
  | 'chat'
  | 'billing'
  | 'documents'
  | 'loyalty'
  | 'support'
  | 'calendar'
  | 'system'
  | 'auth'
export type NotifChannel = 'in_app' | 'email' | 'telegram' | 'push'

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
  // COV-UX-4: категорії існували в бекенд-матриці з першого дня, UI їх не показував —
  // support.*/calendar.* події були прибиті до seed-дефолту без можливості вимкнути.
  { key: 'support', label: 'Підтримка (тікети)' },
  { key: 'calendar', label: 'Календар і зустрічі' },
  { key: 'system', label: 'Система' },
  { key: 'auth', label: 'Безпека' },
]

/** Columns — live channels in the design's order (sms/webhook are future). */
export const NOTIF_CHANNELS: { key: NotifChannel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'push', label: 'Push' }, // S12-03
  { key: 'in_app', label: 'В застосунку' },
]

/** ADR-003: email for these categories is locked ON (critical security/billing events). */
export const LOCKED_EMAIL: ReadonlyArray<NotifCategory> = ['auth', 'billing']

export interface NotifSettingsPayload {
  preferences: NotifPref[]
  // S12-06: тихі години (Kyiv) + ранковий дайджест
  quietFrom: number | null
  quietTo: number | null
  digestDaily: boolean
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get<NotifSettingsPayload>('/profile/notifications'),
  })
}

/** S12-06: PATCH тихі години/дайджест (quietFrom/quietTo — разом або null). */
export function useSaveQuietSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      quietFrom?: number | null
      quietTo?: number | null
      digestDaily?: boolean
    }) => api.patch('/profile/notification-settings', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  })
}

// ── S12-03 Web Push: браузерна підписка ──────────────────────────────────────

function base64ToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function usePushVapidKey() {
  return useQuery({
    queryKey: ['push-vapid-key'],
    queryFn: () =>
      api
        .get<{ publicKey: string | null }>('/notifications/push/vapid-key')
        .then((r) => r.publicKey),
    staleTime: Infinity,
  })
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/** Реєструє sw.js, підписується у браузера і шле підписку на бек. */
export async function subscribeToPush(publicKey: string): Promise<void> {
  const reg = await navigator.serviceWorker.register('/sw.js')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToUint8(publicKey) as BufferSource,
  })
  const json = sub.toJSON()
  await api.post('/notifications/push/subscriptions', {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    userAgent: navigator.userAgent.slice(0, 300),
  })
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api.delete('/notifications/push/subscriptions', { body: { endpoint: sub.endpoint } })
  await sub.unsubscribe()
}

/** Чи є активна підписка в ЦЬОМУ браузері. */
export async function currentPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
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
