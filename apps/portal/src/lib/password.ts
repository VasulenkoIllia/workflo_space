export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  percent: number
}

const LABELS = ['надто короткий', 'слабкий', 'середній', 'добрий', 'сильний'] as const

/** Lightweight client-side password strength estimate (UX hint only; the API is authoritative). */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: '', percent: 0 }
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s++
  if (/[^a-zA-Z0-9]/.test(pw)) s++
  const score = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4
  return { score, label: LABELS[score], percent: ((score + 1) / 5) * 100 }
}
