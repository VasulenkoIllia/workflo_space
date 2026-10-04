/** «−87% часу на обробку» → { v: '−87%', l: 'часу на обробку' }; «18 год → 12 хв щодня» лишає стрілку у v. */
export function splitMetric(m: string): { v: string; l: string } {
  const arrow = m.match(/^(.+?\s*→\s*\d+\S*)\s+(.+)$/)
  if (arrow) return { v: arrow[1] ?? '', l: arrow[2] ?? '' }
  const sp = m.indexOf(' ')
  return sp > 0 ? { v: m.slice(0, sp), l: m.slice(sp + 1) } : { v: m, l: '' }
}
