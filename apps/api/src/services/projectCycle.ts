/**
 * DSN-5: вікно ПОТОЧНОГО білінг-циклу проєкту — для «години цього циклу» (retainer hours-bar
 * у порталі). Якір — `Project.nextCycleAt` (наступне закриття). Цикл = [to − період, to).
 * Якщо крон ще не зсунув якір (nextCycleAt ≤ now) — котимо вікно вперед, щоб не показувати
 * протухлий цикл. `manual` / без якоря → календарний місяць (UTC). Чиста функція (юніт-тести).
 */
export type CycleKind = 'monthly_day_n' | 'weekly_day_x' | 'manual'

export interface CycleWindow {
  from: Date
  to: Date
}

const DAY_MS = 86_400_000

function addMonthsUtc(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  const day = r.getUTCDate()
  r.setUTCDate(1)
  r.setUTCMonth(r.getUTCMonth() + n)
  // cycleDay ≤ 28 за схемою, але якір міг бути поставлений вручну на 29–31 → клемпимо
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate()
  r.setUTCDate(Math.min(day, last))
  return r
}

export function currentCycleWindow(
  cycle: CycleKind,
  nextCycleAt: Date | null,
  now: Date = new Date()
): CycleWindow {
  if (nextCycleAt && cycle !== 'manual') {
    const step = (d: Date, n: number) =>
      cycle === 'weekly_day_x' ? new Date(d.getTime() + n * 7 * DAY_MS) : addMonthsUtc(d, n)
    let to = nextCycleAt
    // протухлий якір (крон не встиг) — котимо вперед, обмежено від нескінченного циклу
    for (let i = 0; i < 520 && to.getTime() <= now.getTime(); i++) to = step(to, 1)
    return { from: step(to, -1), to }
  }
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from, to: addMonthsUtc(from, 1) }
}
