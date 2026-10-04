import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * S12-05 (хвіст) UNSUBSCRIBE: підписаний токен відписки для маркетинг-подібних
 * листів (broadcast). Токен = base64url(email) + '.' + HMAC-SHA256(email, secret) —
 * без стану в БД; verify відновлює email і звіряє підпис constant-time.
 * Секрет: UNSUBSCRIBE_SECRET або JWT_SECRET (обов'язковий у проді).
 */
function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.JWT_SECRET ?? ''
}

function sign(email: string): string {
  return createHmac('sha256', secret()).update(email.toLowerCase()).digest('base64url')
}

export function makeUnsubscribeToken(email: string): string {
  const e = Buffer.from(email.toLowerCase(), 'utf8').toString('base64url')
  return `${e}.${sign(email)}`
}

/** email з валідного токена або null (битий формат / невірний підпис). */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  let email: string
  try {
    email = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!email.includes('@') || email.length > 320) return null
  const expected = Buffer.from(sign(email))
  const actual = Buffer.from(token.slice(dot + 1))
  if (expected.length !== actual.length) return null
  return timingSafeEqual(expected, actual) ? email : null
}

/** Абсолютний URL відписки (API-домен; лінк іде у футер листа + List-Unsubscribe). */
export function unsubscribeUrl(email: string): string {
  const base = process.env.API_PUBLIC_URL ?? 'https://api.workflo.space'
  return `${base}/public/unsubscribe/${makeUnsubscribeToken(email)}`
}
