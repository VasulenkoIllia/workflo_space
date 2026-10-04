import { useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Skeleton } from '@workflo/ui'
import { toast } from 'sonner'
import { Select } from '@/components/Select'
import { useAuth } from '@/contexts/AuthContext'
import { useTeam } from '@/lib/payouts'
import { useClients, useClientMembers } from '@/lib/clients'
import {
  useCalendarEvents,
  useCalendarView,
  useCancelEvent,
  useCreateEvent,
  useUpdateEvent,
  type CalendarEventDto,
  type CreateEventInput,
} from '@/lib/calendar'
import { DayView, WeekView } from './TimeGridViews'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
]

const LEAVE_TYPE_LABEL: Record<string, string> = {
  vacation: 'відпустка',
  sick: 'лікарняний',
  dayoff: 'відгул',
  unpaid: 'за свій рахунок',
}
const LEAVE_TYPE_ICON: Record<string, string> = {
  vacation: '🏖',
  sick: '🤒',
  dayoff: '🌤',
  unpaid: '⏸',
}

function monthRange(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1))
  const last = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))
  return { from: first.toISOString(), to: last.toISOString() }
}
function dayKey(iso: string) {
  return iso.slice(0, 10)
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

type View = 'month' | 'week' | 'day'
const VIEW_LABEL: Record<View, string> = { month: 'Місяць', week: 'Тиждень', day: 'День' }

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function mondayOf(d: Date) {
  return addDays(startOfDay(d), -((d.getDay() + 6) % 7))
}

export function CalendarPage() {
  const now = new Date()
  // DSN-7: Місяць · Тиждень · День (design-v2 workspace-calendar.jsx)
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(() => startOfDay(now))
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const weekStart = mondayOf(anchor)
  const { from, to } = useMemo(() => {
    if (view === 'month') return monthRange(year, month)
    const start = view === 'week' ? mondayOf(anchor) : startOfDay(anchor)
    const end = addDays(start, view === 'week' ? 7 : 1)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [view, anchor, year, month])
  const { data: items, isLoading } = useCalendarView(from, to)
  const { data: eventsData } = useCalendarEvents(from, to)
  const events = eventsData?.events
  const leaves = eventsData?.leaves
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>()
    for (const it of items ?? []) {
      const k = dayKey(it.at)
      map.set(k, [...(map.get(k) ?? []), it])
    }
    return map
  }, [items])

  // S13-05: відсутності — діапазонні; розгортаємо в day-ключі (стеля 62 дні/заявка).
  const leavesByDay = useMemo(() => {
    const map = new Map<string, { name: string; type: string }[]>()
    for (const l of leaves ?? []) {
      const start = new Date(l.startDate)
      const end = new Date(l.endDate)
      for (let t = start.getTime(), i = 0; t <= end.getTime() && i < 62; t += 86_400_000, i += 1) {
        const k = new Date(t).toISOString().slice(0, 10)
        map.set(k, [...(map.get(k) ?? []), { name: l.profile.name, type: l.type }])
      }
    }
    return map
  }, [leaves])

  // Сітка: перший день місяця → зсув до понеділка; 6 тижнів × 7
  const gridStart = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1))
    const dow = (first.getUTCDay() + 6) % 7 // Пн=0
    return new Date(Date.UTC(year, month, 1 - dow))
  }, [year, month])
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getTime() + i * 86_400_000)
    return { date: d, iso: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === month }
  })

  const shift = (delta: number) =>
    setAnchor(
      view === 'month'
        ? new Date(year, month + delta, 1)
        : addDays(anchor, delta * (view === 'week' ? 7 : 1))
    )
  const periodLabel =
    view === 'month'
      ? `${MONTHS[month]} ${year}`
      : view === 'week'
        ? `${weekStart.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })} – ${addDays(
            weekStart,
            6
          ).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        : anchor.toLocaleDateString('uk-UA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
  const openDay = (d: Date) => {
    setAnchor(startOfDay(d))
    setView('day')
  }
  const selectedEvent = events?.find((e) => e.id === selected) ?? null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Календар</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // зустрічі + дедлайни замовлень
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Зустріч
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Button size="sm" variant="ghost" onClick={() => shift(-1)}>
          ←
        </Button>
        <div style={{ fontWeight: 600, minWidth: 160, textAlign: 'center' }}>{periodLabel}</div>
        <Button size="sm" variant="ghost" onClick={() => shift(1)}>
          →
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAnchor(startOfDay(new Date()))}>
          Сьогодні
        </Button>
        <div className="wfcal-views" role="tablist">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className="wfcal-view"
              data-on={view === v || undefined}
              onClick={() => setView(v)}
              style={{ border: 0, font: 'inherit' }}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 400 }} />
      ) : view === 'week' ? (
        <WeekView
          days={Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))}
          events={events ?? []}
          items={items ?? []}
          leaves={leaves ?? []}
          onSelect={setSelected}
          onOpenDay={openDay}
        />
      ) : view === 'day' ? (
        <DayView
          day={anchor}
          events={events ?? []}
          items={items ?? []}
          leaves={leaves ?? []}
          onOpen={setSelected}
        />
      ) : (
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="wfp-mono"
                style={{
                  fontSize: 10,
                  color: 'var(--wf-fg-muted)',
                  textAlign: 'center',
                  padding: '4px 0',
                }}
              >
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const dayItems = byDay.get(c.iso) ?? []
              const dayLeaves = leavesByDay.get(c.iso) ?? []
              const isToday = c.iso === now.toISOString().slice(0, 10)
              return (
                <div
                  key={c.iso}
                  style={{
                    minHeight: 84,
                    padding: 4,
                    border: '1px solid var(--wf-border)',
                    background: c.inMonth ? 'transparent' : 'var(--wf-surface)',
                    opacity: c.inMonth ? 1 : 0.5,
                  }}
                >
                  <button
                    type="button"
                    className="wfp-mono"
                    title="Відкрити день"
                    onClick={() =>
                      openDay(
                        new Date(c.date.getUTCFullYear(), c.date.getUTCMonth(), c.date.getUTCDate())
                      )
                    }
                    style={{
                      fontSize: 11,
                      color: isToday ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
                      fontWeight: isToday ? 700 : 400,
                      marginBottom: 3,
                      background: 'none',
                      border: 0,
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {c.date.getUTCDate()}
                  </button>
                  <div style={{ display: 'grid', gap: 2 }}>
                    {(dayItems ?? []).slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        disabled={it.kind === 'deadline'}
                        onClick={() => it.kind === 'meeting' && setSelected(it.id)}
                        style={{
                          fontSize: 10,
                          textAlign: 'left',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: it.kind === 'meeting' ? 'pointer' : 'default',
                          background:
                            it.kind === 'deadline'
                              ? 'var(--wf-warning-bg, rgba(255,180,0,0.12))'
                              : 'var(--wf-accent-bg, rgba(80,120,255,0.12))',
                          color: 'var(--wf-fg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={it.title}
                      >
                        {it.kind === 'deadline' ? '⏳ ' : `${fmtTime(it.at)} `}
                        {it.title}
                      </button>
                    ))}
                    {(dayItems ?? []).length > 3 && (
                      <span
                        className="wfp-mono"
                        style={{ fontSize: 9, color: 'var(--wf-fg-muted)' }}
                      >
                        +{(dayItems ?? []).length - 3}
                      </span>
                    )}
                    {/* S13-05: погоджені відсутності команди (read-only чіпи) */}
                    {dayLeaves.slice(0, 2).map((l, i) => (
                      <span
                        key={`leave-${c.iso}-${i}`}
                        title={`${l.name} — ${LEAVE_TYPE_LABEL[l.type] ?? l.type}`}
                        style={{
                          fontSize: 10,
                          padding: '2px 4px',
                          borderRadius: 4,
                          background: 'var(--wf-surface)',
                          border: '1px dashed var(--wf-border-strong)',
                          color: 'var(--wf-fg-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {LEAVE_TYPE_ICON[l.type] ?? '🏖'} {l.name}
                      </span>
                    ))}
                    {dayLeaves.length > 2 && (
                      <span
                        className="wfp-mono"
                        style={{ fontSize: 9, color: 'var(--wf-fg-muted)' }}
                      >
                        +{dayLeaves.length - 2} відсутні
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {creating && <CreateEventModal onClose={() => setCreating(false)} />}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

const controlStyle = {
  width: '100%',
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 13,
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const create = useCreateEvent()
  const { data: team } = useTeam()
  const { can } = useAuth()
  // PERM: клієнтські зустрічі з учасниками клієнта — для ролей із clients.view
  const { clients } = useClients(can('clients.view'))
  const [companyIdForMembers, setCompanyIdForMembers] = useState('')
  const { data: clientMembersData } = useClientMembers(
    companyIdForMembers,
    companyIdForMembers !== ''
  )
  const [type, setType] = useState<'internal_meeting' | 'client_meeting'>('internal_meeting')
  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])

  const toggle = (id: string) =>
    setAttendees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const valid =
    title.trim().length >= 2 && date !== '' && (type === 'internal_meeting' || companyId !== '')

  const submit = () => {
    const startsAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endsAt = new Date(`${date}T${endTime}:00`).toISOString()
    const body: CreateEventInput = {
      title: title.trim(),
      type,
      startsAt,
      endsAt,
      attendeeIds: attendees,
      ...(type === 'client_meeting' ? { companyId } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
    }
    create.mutate(body, {
      onSuccess: () => {
        toast.success('Зустріч створено, запрошення надіслано')
        onClose()
      },
    })
  }

  // клієнтські контакти доступні лише для client_meeting з обраною компанією
  const clientMembers =
    type === 'client_meeting' && companyId ? (clientMembersData?.members ?? []) : []

  return (
    <Modal
      open
      onClose={onClose}
      title="Нова зустріч"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Скасувати
          </Button>
          <Button variant="primary" loading={create.isPending} disabled={!valid} onClick={submit}>
            Створити
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant={type === 'internal_meeting' ? 'primary' : 'secondary'}
            onClick={() => setType('internal_meeting')}
          >
            Команда
          </Button>
          <Button
            size="sm"
            variant={type === 'client_meeting' ? 'primary' : 'secondary'}
            onClick={() => setType('client_meeting')}
          >
            З клієнтом
          </Button>
        </div>
        <Input
          label="Назва"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Демо продукту"
        />
        {type === 'client_meeting' && (
          <Select
            label="Клієнт"
            value={companyId}
            onChange={(v) => {
              setCompanyId(v)
              setCompanyIdForMembers(v)
              setAttendees([])
            }}
            options={[
              { value: '', label: '— оберіть —' },
              ...(clients ?? []).map((c) => ({ value: c.companyId, label: c.name })),
            ]}
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ДАТА
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={controlStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ПОЧАТОК
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={controlStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              КІНЕЦЬ
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={controlStyle}
            />
          </label>
        </div>
        <Input
          label="Локація (опц.)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Офіс / адреса"
        />
        <Input
          label="Посилання на дзвінок (опц.)"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://meet…"
        />
        <div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
          >
            ЗАПРОСИТИ
          </div>
          <div style={{ display: 'grid', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {(team?.members ?? []).map((m) => (
              <label
                key={m.profileId}
                style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={attendees.includes(m.profileId)}
                  onChange={() => toggle(m.profileId)}
                />
                {m.name}{' '}
                <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                  команда
                </span>
              </label>
            ))}
            {clientMembers.map((m) => (
              <label
                key={m.profileId}
                style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={attendees.includes(m.profileId)}
                  onChange={() => toggle(m.profileId)}
                />
                {m.name}{' '}
                <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-accent)' }}>
                  клієнт
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** datetime-local значення з ISO (локальний час браузера). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function EventDetailModal({ event, onClose }: { event: CalendarEventDto; onClose: () => void }) {
  const cancel = useCancelEvent()
  const update = useUpdateEvent()
  const { user, can } = useAuth()
  // PERM-6: чужу подію — calendar.manage (власник має завжди)
  const canManage = event.createdById === user?.profile.id || can('calendar.manage')
  const RESP_LABEL = { pending: 'очікує', accepted: 'прийняв', declined: 'відхилив' }
  // COV-UX-5: редагування (PATCH існував з CAL-MVP, UI не було)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [startsAt, setStartsAt] = useState(() => toLocalInput(event.startsAt))
  const [endsAt, setEndsAt] = useState(() => toLocalInput(event.endsAt))
  const [location, setLocation] = useState(event.location ?? '')

  if (editing) {
    const save = () => {
      const s = new Date(startsAt)
      const e = new Date(endsAt)
      if (!(e.getTime() > s.getTime())) {
        toast.error('Кінець має бути пізніше початку')
        return
      }
      update.mutate(
        {
          id: event.id,
          title: title.trim(),
          startsAt: s.toISOString(),
          endsAt: e.toISOString(),
          location: location.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success('Зустріч оновлено')
            setEditing(false)
          },
        }
      )
    }
    return (
      <Modal
        open
        onClose={onClose}
        title="Редагувати зустріч"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Скасувати
            </Button>
            <Button
              variant="primary"
              loading={update.isPending}
              disabled={title.trim().length < 2}
              onClick={save}
            >
              Зберегти
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input label="Назва" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              label="Початок"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <Input
              label="Кінець"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <Input
            label="Локація (необовʼязково)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={event.title}
      aux={event.type === 'client_meeting' ? (event.company?.name ?? 'клієнт') : 'команда'}
      footer={
        canManage && !event.cancelledAt ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Редагувати
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(event.id, {
                  onSuccess: () => {
                    toast.success('Зустріч скасовано')
                    onClose()
                  },
                })
              }
            >
              Скасувати зустріч
            </Button>
          </div>
        ) : null
      }
    >
      <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
        <div>
          <span style={{ color: 'var(--wf-fg-secondary)' }}>Час: </span>
          {new Date(event.startsAt).toLocaleString('uk-UA', { timeZone: event.timezone })} –{' '}
          {fmtTime(event.endsAt)}{' '}
          <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            ({event.timezone})
          </span>
        </div>
        {event.location && (
          <div>
            <span style={{ color: 'var(--wf-fg-secondary)' }}>Локація: </span>
            {event.location}
          </div>
        )}
        {event.meetingUrl && (
          <div>
            <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="wfp-link">
              Приєднатися до дзвінка →
            </a>
          </div>
        )}
        {event.description && <div style={{ whiteSpace: 'pre-wrap' }}>{event.description}</div>}
        <div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 4 }}
          >
            УЧАСНИКИ
          </div>
          {event.attendees.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Без запрошених.</div>
          ) : (
            event.attendees.map((a) => (
              <div
                key={a.profileId}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
              >
                <span>{a.profile.name}</span>
                <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {RESP_LABEL[a.response]}
                </span>
              </div>
            ))
          )}
        </div>
        {event.cancelledAt && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 13 }}>Зустріч скасовано.</div>
        )}
      </div>
    </Modal>
  )
}
