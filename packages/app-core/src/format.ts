import { differenceInCalendarDays, format } from 'date-fns'

/** dd.MM.yyyy (numeric — locale-independent). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(new Date(iso), 'dd.MM.yyyy')
}

/** "$4 200" — prefix + uk-UA space-grouped, matching the design. */
export function formatMoney(amount: number | null | undefined): string {
  // Guard non-finite too: `num(badString)` returns NaN, and `NaN.toLocaleString()` → "NaN".
  if (amount == null || !Number.isFinite(amount)) return '—'
  return `$${amount.toLocaleString('uk-UA')}`
}

export type DeadlineTone = 'over' | 'soon' | 'ok' | null

export function deadlineMeta(
  iso: string | null | undefined,
  now: Date = new Date()
): {
  label: string
  tone: DeadlineTone
} {
  if (!iso) return { label: 'без дедлайну', tone: null }
  const days = differenceInCalendarDays(new Date(iso), now)
  if (days < 0) return { label: 'прострочено', tone: 'over' }
  if (days <= 3) return { label: 'скоро', tone: 'soon' }
  return { label: 'у строк', tone: 'ok' }
}

/** "dd.MM HH:mm" — compact timestamp for chat/activity. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(new Date(iso), 'dd.MM HH:mm')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
