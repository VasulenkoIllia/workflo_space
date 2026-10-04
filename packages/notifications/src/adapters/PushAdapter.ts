import webpush from 'web-push'

/**
 * S12-03 Web Push adapter (VAPID). Ключі з env — без них канал м'яко вимкнений
 * (dispatch поверне skipped 'push_not_configured', матриця користувача не ламається).
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — пара з `npx web-push generate-vapid-keys`
 *   VAPID_SUBJECT — mailto: контакт (дефолт mailto:support@workflo.space)
 */

export interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  /** Куди веде клік по сповіщенню (відносний або абсолютний URL). */
  url?: string
}

export type PushSendResult =
  | { status: 'sent' }
  | { status: 'gone' } // 404/410 — підписка мертва, рядок треба видалити
  | { status: 'failed'; reason: string }

let configured = false
let initialized = false

function ensureInit(): boolean {
  if (initialized) return configured
  initialized = true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (configured = false)
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:support@workflo.space', pub, priv)
  return (configured = true)
}

export function pushConfigured(): boolean {
  return ensureInit()
}

export function pushPublicKey(): string | null {
  return ensureInit() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null
}

/** Надіслати одне пуш-повідомлення на одну підписку. Ніколи не кидає. */
export async function sendWebPush(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<PushSendResult> {
  if (!ensureInit()) return { status: 'failed', reason: 'push_not_configured' }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 3600 }
    )
    return { status: 'sent' }
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) return { status: 'gone' }
    return {
      status: 'failed',
      reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    }
  }
}

/** Тест-шов: скинути ліниву ініціалізацію (env міняється між тестами). */
export function resetPushAdapterForTests(): void {
  initialized = false
  configured = false
}
