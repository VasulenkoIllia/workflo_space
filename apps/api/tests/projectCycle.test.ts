import { describe, expect, it } from 'vitest'
import { currentCycleWindow } from '../src/services/projectCycle.js'

const d = (s: string) => new Date(s)

describe('currentCycleWindow (DSN-5 retainer hours-bar)', () => {
  it('monthly: window = [anchor − 1 month, anchor)', () => {
    const w = currentCycleWindow(
      'monthly_day_n',
      d('2026-10-05T00:00:00Z'),
      d('2026-09-27T10:00:00Z')
    )
    expect(w.from.toISOString()).toBe('2026-09-05T00:00:00.000Z')
    expect(w.to.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })

  it('monthly: stale anchor (cron lag) rolls forward to the cycle containing now', () => {
    const w = currentCycleWindow(
      'monthly_day_n',
      d('2026-08-05T00:00:00Z'),
      d('2026-09-27T10:00:00Z')
    )
    expect(w.from.toISOString()).toBe('2026-09-05T00:00:00.000Z')
    expect(w.to.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })

  it('monthly: month-end anchor clamps (31 → 30/28)', () => {
    const w = currentCycleWindow(
      'monthly_day_n',
      d('2026-03-31T00:00:00Z'),
      d('2026-03-20T00:00:00Z')
    )
    expect(w.from.toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })

  it('weekly: window = [anchor − 7d, anchor)', () => {
    const w = currentCycleWindow(
      'weekly_day_x',
      d('2026-09-28T00:00:00Z'),
      d('2026-09-27T10:00:00Z')
    )
    expect(w.from.toISOString()).toBe('2026-09-21T00:00:00.000Z')
    expect(w.to.toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })

  it('manual / no anchor → calendar month (UTC)', () => {
    for (const w of [
      currentCycleWindow('manual', d('2026-10-05T00:00:00Z'), d('2026-09-27T10:00:00Z')),
      currentCycleWindow('monthly_day_n', null, d('2026-09-27T10:00:00Z')),
    ]) {
      expect(w.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
      expect(w.to.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    }
  })
})
