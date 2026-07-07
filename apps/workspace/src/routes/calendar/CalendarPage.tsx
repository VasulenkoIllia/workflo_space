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
  type CalendarEventDto,
  type CreateEventInput,
} from '@/lib/calendar'

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

export function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const { from, to } = useMemo(() => monthRange(year, month), [year, month])
  const { data: items, isLoading } = useCalendarView(from, to)
  const { data: events } = useCalendarEvents(from, to)
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

  const shift = (delta: number) => {
    const m = month + delta
    setYear(year + Math.floor(m / 12))
    setMonth(((m % 12) + 12) % 12)
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
        <div style={{ fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
          {MONTHS[month]} {year}
        </div>
        <Button size="sm" variant="ghost" onClick={() => shift(1)}>
          →
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setYear(now.getFullYear())
            setMonth(now.getMonth())
          }}
        >
          Сьогодні
        </Button>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 400 }} />
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
                  <div
                    className="wfp-mono"
                    style={{
                      fontSize: 11,
                      color: isToday ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
                      fontWeight: isToday ? 700 : 400,
                      marginBottom: 3,
                    }}
                  >
                    {c.date.getUTCDate()}
                  </div>
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
  const { clients } = useClients()
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
      onError: () => toast.error('Не вдалося створити (перевірте час/учасників)'),
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

function EventDetailModal({ event, onClose }: { event: CalendarEventDto; onClose: () => void }) {
  const cancel = useCancelEvent()
  const { user } = useAuth()
  const isOwner = user?.agencyMemberships?.some((m) => m.role === 'owner')
  const canManage = event.createdById === user?.profile.id || isOwner
  const RESP_LABEL = { pending: 'очікує', accepted: 'прийняв', declined: 'відхилив' }

  return (
    <Modal
      open
      onClose={onClose}
      title={event.title}
      aux={event.type === 'client_meeting' ? (event.company?.name ?? 'клієнт') : 'команда'}
      footer={
        canManage && !event.cancelledAt ? (
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
