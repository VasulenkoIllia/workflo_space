import { useState } from 'react'
import { Button, EmptyState } from '@workflo/ui'
import type { CalendarEventDto, CalendarLeaveDto, CalendarViewItem } from '@/lib/calendar'

/**
 * DSN-7 · design-v2 workspace-calendar.jsx → CalendarWeek / CalendarDay. Часова сітка 8–20
 * (події поза нею притискаються до країв), дедлайни й відсутності — рядком «весь день».
 * Усе в локальному часі переглядача.
 */

export const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i) // 8:00 … 20:00
const H = 46
const ALLDAY_H = 30
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hm = (d: Date) => d.getHours() + d.getMinutes() / 60
const fmt = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
const evType = (e: CalendarEventDto) => (e.type === 'client_meeting' ? 'client' : 'internal')

function eventsOn(events: CalendarEventDto[], day: Date) {
  const k = localKey(day)
  return events.filter((e) => localKey(new Date(e.startsAt)) === k)
}
function deadlinesOn(items: CalendarViewItem[], day: Date) {
  const k = localKey(day)
  return items.filter((i) => i.kind === 'deadline' && localKey(new Date(i.at)) === k)
}
function leavesOn(leaves: CalendarLeaveDto[], day: Date) {
  const k = localKey(day)
  return leaves.filter((l) => l.startDate.slice(0, 10) <= k && k <= l.endDate.slice(0, 10))
}

function blockPos(e: CalendarEventDto) {
  const start = Math.max(HOURS[0]!, Math.min(hm(new Date(e.startsAt)), HOURS.at(-1)! + 0.5))
  const end = Math.min(HOURS.at(-1)! + 1, Math.max(hm(new Date(e.endsAt)), start + 0.5))
  return { top: (start - HOURS[0]!) * H, height: Math.max((end - start) * H - 4, 20) }
}

function AllDayChips({
  deadlines,
  leaves,
}: {
  deadlines: CalendarViewItem[]
  leaves: CalendarLeaveDto[]
}) {
  const n = deadlines.length + leaves.length
  if (n === 0) return null
  const first = deadlines[0]
  return (
    <span
      className="wfcal-pill"
      data-type={first ? 'deadline' : 'leave'}
      title={[
        ...deadlines.map((d) => `⏳ ${d.title}`),
        ...leaves.map((l) => `🏖 ${l.profile.name}`),
      ].join('\n')}
      style={{ maxWidth: '100%' }}
    >
      {first ? `⏳ ${first.title}` : `🏖 ${leaves[0]!.profile.name}`}
      {n > 1 ? ` +${n - 1}` : ''}
    </span>
  )
}

export function WeekView({
  days,
  events,
  items,
  leaves,
  onSelect,
  onOpenDay,
}: {
  days: Date[]
  events: CalendarEventDto[]
  items: CalendarViewItem[]
  leaves: CalendarLeaveDto[]
  onSelect: (id: string) => void
  onOpenDay: (d: Date) => void
}) {
  const today = localKey(new Date())
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="wfcal-week" style={{ minWidth: 760 }}>
        <div className="wfcal-week-times">
          <div style={{ height: 40 + ALLDAY_H }} />
          {HOURS.map((h) => (
            <div className="wfcal-week-time" key={h}>
              {h}:00
            </div>
          ))}
        </div>
        <div className="wfcal-week-cols">
          {days.map((day, di) => (
            <div className="wfcal-week-col" key={localKey(day)}>
              <button
                type="button"
                className={`wfcal-week-colhead${localKey(day) === today ? ' is-today' : ''}`}
                onClick={() => onOpenDay(day)}
                title="Відкрити день"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 0,
                  borderBottom: '1px solid var(--wf-border)',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                {DOW[di]} {day.getDate()}.{String(day.getMonth() + 1).padStart(2, '0')}
              </button>
              <div
                style={{
                  height: ALLDAY_H,
                  padding: '3px 3px 0',
                  borderBottom: '1px solid var(--wf-border)',
                  overflow: 'hidden',
                }}
              >
                <AllDayChips deadlines={deadlinesOn(items, day)} leaves={leavesOn(leaves, day)} />
              </div>
              <div className="wfcal-week-body" style={{ height: HOURS.length * H }}>
                {HOURS.map((h) => (
                  <div className="wfcal-week-slot" key={h} style={{ height: H }} />
                ))}
                {eventsOn(events, day).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="wfcal-block"
                    data-type={evType(e)}
                    onClick={() => onSelect(e.id)}
                    style={{
                      ...blockPos(e),
                      textAlign: 'left',
                      font: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="wfcal-block-t">{e.title}</div>
                    <div className="wfcal-block-time">{fmt(new Date(e.startsAt))}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DayView({
  day,
  events,
  items,
  leaves,
  onOpen,
}: {
  day: Date
  events: CalendarEventDto[]
  items: CalendarViewItem[]
  leaves: CalendarLeaveDto[]
  onOpen: (id: string) => void
}) {
  const dayEvents = eventsOn(events, day).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const deadlines = deadlinesOn(items, day)
  const away = leavesOn(leaves, day)
  const [picked, setPicked] = useState<string | null>(null)
  const sel = dayEvents.find((e) => e.id === picked) ?? dayEvents[0] ?? null

  if (dayEvents.length === 0 && deadlines.length === 0 && away.length === 0) {
    return (
      <EmptyState
        glyph="// ∅"
        title="Вільний день"
        description="Зустрічей, дедлайнів і відсутностей на цей день немає."
      />
    )
  }

  return (
    <div className="wfcal-day-view">
      <div className="wfcal-day-sched">
        {(deadlines.length > 0 || away.length > 0) && (
          <div className="wfcal-day-hour">
            <div className="wfcal-day-hr">весь день</div>
            <div className="wfcal-day-slot" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {deadlines.map((d) => (
                <span key={d.id} className="wfcal-pill" data-type="deadline">
                  ⏳ {d.title}
                </span>
              ))}
              {away.map((l) => (
                <span key={l.id} className="wfcal-pill" data-type="leave">
                  🏖 {l.profile.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {HOURS.map((h) => {
          const evts = dayEvents.filter((e) => {
            const s = Math.floor(hm(new Date(e.startsAt)))
            return h === HOURS[0] ? s <= h : h === HOURS.at(-1) ? s >= h : s === h
          })
          return (
            <div className="wfcal-day-hour" key={h}>
              <div className="wfcal-day-hr">{h}:00</div>
              <div className="wfcal-day-slot">
                {evts.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="wfcal-day-evt"
                    data-type={evType(e)}
                    data-sel={e.id === sel?.id || undefined}
                    onClick={() => setPicked(e.id)}
                    style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
                  >
                    <div className="wfcal-day-evt-t">{e.title}</div>
                    <div className="wfcal-day-evt-m">
                      {fmt(new Date(e.startsAt))}–{fmt(new Date(e.endsAt))}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {sel && (
        <div className="wfcal-detail" data-type={evType(sel)}>
          <span className="wfcal-detail-type">
            {sel.type === 'client_meeting' ? 'клієнтська' : 'внутрішня'}
          </span>
          <div className="wfcal-detail-t">{sel.title}</div>
          <div className="wfcal-detail-row">
            <span className="k">час</span>
            <span>
              {fmt(new Date(sel.startsAt))}–{fmt(new Date(sel.endsAt))}
            </span>
          </div>
          {sel.location && (
            <div className="wfcal-detail-row">
              <span className="k">де</span>
              <span>{sel.location}</span>
            </div>
          )}
          <div className="wfcal-detail-actions">
            <Button size="sm" onClick={() => onOpen(sel.id)}>
              Деталі й учасники
            </Button>
            {sel.meetingUrl && (
              <a className="wfp-link" href={sel.meetingUrl} target="_blank" rel="noreferrer">
                приєднатись →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
