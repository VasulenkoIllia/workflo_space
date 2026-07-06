import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useCommentStream } from '@workflo/app-core'
import { EmptyState, Skeleton } from '@workflo/ui'
import { api } from '@/lib/api'
import { useConversations, useSetConversationState, type Conversation } from '@/lib/chats'
import { ChatTab } from '@/routes/orders/ChatTab'

/**
 * «Чати» (18-А, рішення власника 05.07): єдиний хаб розмов. Master-detail —
 * зліва треди, згруповані КЛІЄНТ → замовлення (канон групування), з unread-бейджами
 * і прев'ю; праворуч повний чат замовлення (спільний <ChatTab> з mute/відповідальним).
 * Фільтри «всі / мої / без відповіді / архів» — по прапорцях list-ендпоінта.
 */
type Filter = 'all' | 'mine' | 'unanswered' | 'snoozed' | 'archived'

/** 18-Б: тред відкладено і час ще не настав. */
const isSnoozedNow = (c: { snoozedUntil: string | null }): boolean =>
  c.snoozedUntil != null && new Date(c.snoozedUntil).getTime() > Date.now()

/** 18-Б: snooze минув — «повернути непрочитаною» = ⏰-маркер у списку. */
const isSnoozeDue = (c: { snoozedUntil: string | null }): boolean =>
  c.snoozedUntil != null && new Date(c.snoozedUntil).getTime() <= Date.now()

const SNOOZE_PRESETS: { label: string; hours?: number; tomorrow?: boolean }[] = [
  { label: 'на 1 год', hours: 1 },
  { label: 'на 4 год', hours: 4 },
  { label: 'до завтра 9:00', tomorrow: true },
]

function presetToIso(p: (typeof SNOOZE_PRESETS)[number]): string {
  if (p.tomorrow) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString()
  }
  return new Date(Date.now() + (p.hours ?? 1) * 3_600_000).toISOString()
}

/** Вузький екран → master-detail стає «список ⇄ чат» з кнопкою назад. */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'всі' },
  { id: 'mine', label: 'мої' },
  { id: 'unanswered', label: 'без відповіді' },
  { id: 'snoozed', label: 'відкладені' },
  { id: 'archived', label: 'архів' },
]

const timeShort = (iso: string): string => {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

function matches(c: Conversation, filter: Filter): boolean {
  if (filter === 'archived') return c.archived
  if (c.archived) return false
  if (filter === 'snoozed') return isSnoozedNow(c)
  // 18-Б: активний snooze ховає тред з основних фільтрів до настання часу
  if (isSnoozedNow(c)) return false
  if (filter === 'mine') return c.mine
  if (filter === 'unanswered')
    return (
      c.lastMessage != null &&
      !c.lastMessage.authorIsTeam &&
      !['done', 'cancelled'].includes(c.internalStatus)
    )
  return true
}

function ThreadRow({
  c,
  active,
  onClick,
}: {
  c: Conversation
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: active ? 'color-mix(in oklab, var(--wf-accent) 10%, transparent)' : 'none',
        border: 0,
        borderLeft: active ? '2px solid var(--wf-accent)' : '2px solid transparent',
        padding: '8px 10px',
        cursor: 'pointer',
        color: 'var(--wf-fg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: c.unread > 0 ? 700 : 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {c.muted ? '🔕 ' : ''}
          {isSnoozeDue(c) ? '⏰ ' : ''}
          {c.title}
        </span>
        {isSnoozedNow(c) && (
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-warning, #b45309)' }}>
            ⏰ до {timeShort(c.snoozedUntil ?? '')}
          </span>
        )}
        {c.lastMessage && (
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            {timeShort(c.lastMessage.at)}
          </span>
        )}
        {c.unread > 0 && (
          <span
            className="wfp-mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--wf-accent)',
              color: 'var(--wf-accent-contrast, #111)',
              borderRadius: 999,
              padding: '1px 6px',
            }}
          >
            {c.unread}
          </span>
        )}
      </div>
      {c.lastMessage && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--wf-fg-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 2,
          }}
        >
          {c.lastMessage.isInternal ? '🔒 ' : ''}
          {c.lastMessage.authorName}: {c.lastMessage.preview}
        </div>
      )}
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 2 }}>
        {c.chatOwnerName ? `відп.: ${c.chatOwnerName}` : 'без відповідального'}
      </div>
    </button>
  )
}

export function ChatsPage() {
  const { data, isLoading } = useConversations()
  const qc = useQueryClient()
  const isNarrow = useIsNarrow()
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Живий чат обраного треда (SSE); '' → no-op усередині хука.
  useCommentStream(selectedId ?? '')
  const setConvState = useSetConversationState(selectedId ?? '')

  const rows = useMemo(
    () => (data?.conversations ?? []).filter((c) => matches(c, filter)),
    [data, filter]
  )
  // Канон 18-А: групування клієнт → замовлення (порядок груп = найсвіжіше повідомлення).
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: Conversation[] }>()
    for (const c of rows) {
      const key = c.companyId ?? '(internal)'
      const g = m.get(key) ?? { name: c.companyName ?? 'Внутрішні', rows: [] }
      g.rows.push(c)
      m.set(key, g)
    }
    return [...m.values()]
  }, [rows])

  const selected = rows.find((c) => c.orderId === selectedId) ?? null
  const unreadTotal = (data?.conversations ?? []).reduce(
    (s, c) => s + (c.archived ? 0 : c.unread),
    0
  )

  const select = (id: string) => {
    setSelectedId(id)
    // відкриття чату маркує прочитаним (markCommentsRead у <OrderChat>) → оновити бейджі
    setTimeout(() => void qc.invalidateQueries({ queryKey: ['ws-conversations'] }), 1500)
  }

  // 18-Б: відкриття треда з простроченим snooze знімає ⏰ (увагу повернуто).
  const openThread = (c: Conversation) => {
    select(c.orderId)
    if (isSnoozeDue(c)) {
      void api
        .put(`/orders/${c.orderId}/conversation`, { snoozeUntil: null })
        .then(() => qc.invalidateQueries({ queryKey: ['ws-conversations'] }))
    }
  }

  const snooze = (until: string | null) => {
    if (!selected) return
    setConvState.mutate(
      { snoozeUntil: until },
      {
        onSuccess: () => {
          toast.success(until ? 'Розмову відкладено' : 'Snooze знято')
          void qc.invalidateQueries({ queryKey: ['ws-conversations'] })
          if (until) setSelectedId(null) // відкладений тред зникає з основного списку
        },
      }
    )
  }

  const toggleArchive = () => {
    if (!selected) return
    setConvState.mutate(
      { archived: !selected.archived },
      {
        onSuccess: () => {
          toast.success(selected.archived ? 'Розмову повернено' : 'Розмову архівовано')
          void qc.invalidateQueries({ queryKey: ['ws-conversations'] })
        },
      }
    )
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            // всі розмови з клієнтами{unreadTotal > 0 ? ` · непрочитаних: ${unreadTotal}` : ''}
          </div>
          <h1 className="wfp-ph-h1">Чати</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '12px 0 16px' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="wfp-pill"
            data-on={filter === f.id || undefined}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : (data?.conversations ?? []).length === 0 ? (
        <EmptyState
          title="Розмов ще немає"
          description="Щойно в замовленнях зʼявляться повідомлення — вони зберуться тут."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : 'minmax(260px, 340px) 1fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              overflow: 'hidden',
              maxHeight: '70vh',
              overflowY: 'auto',
              // вузько: показуємо АБО список, АБО чат
              display: isNarrow && selected ? 'none' : undefined,
            }}
          >
            {rows.length === 0 ? (
              <div
                className="wfp-mono"
                style={{ fontSize: 12, color: 'var(--wf-fg-muted)', padding: 14 }}
              >
                // за цим фільтром порожньо
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.name}>
                  <div
                    className="wfp-mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--wf-fg-muted)',
                      padding: '8px 10px 2px',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                    }}
                  >
                    {g.name}
                  </div>
                  {g.rows.map((c) => (
                    <ThreadRow
                      key={c.orderId}
                      c={c}
                      active={c.orderId === selectedId}
                      onClick={() => openThread(c)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          <div style={{ minWidth: 0, display: isNarrow && !selected ? 'none' : undefined }}>
            {selected ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {isNarrow && (
                    <button
                      type="button"
                      className="wfp-link"
                      style={{ fontSize: 12 }}
                      onClick={() => setSelectedId(null)}
                    >
                      ← список
                    </button>
                  )}
                  <Link
                    to={`/orders/${selected.orderId}`}
                    style={{ fontSize: 15, fontWeight: 600, color: 'var(--wf-fg)' }}
                  >
                    {selected.title} ↗
                  </Link>
                  <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                    {selected.companyName ?? 'внутрішнє'}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                    {isSnoozedNow(selected) ? (
                      <button
                        type="button"
                        className="wfp-link"
                        style={{ fontSize: 12 }}
                        onClick={() => snooze(null)}
                        disabled={setConvState.isPending}
                      >
                        ⏰ зняти snooze
                      </button>
                    ) : (
                      <select
                        className="wfp-mono"
                        style={{
                          background: 'var(--wf-surface)',
                          color: 'var(--wf-fg)',
                          border: '1px solid var(--wf-border)',
                          borderRadius: 'var(--wf-radius)',
                          fontSize: 11,
                          padding: '2px 6px',
                        }}
                        value=""
                        disabled={setConvState.isPending}
                        onChange={(e) => {
                          const p = SNOOZE_PRESETS[Number(e.target.value)]
                          if (p) snooze(presetToIso(p))
                        }}
                      >
                        <option value="" disabled>
                          ⏰ відкласти…
                        </option>
                        {SNOOZE_PRESETS.map((p, i) => (
                          <option key={p.label} value={i}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="wfp-link"
                      style={{ fontSize: 12 }}
                      onClick={toggleArchive}
                      disabled={setConvState.isPending}
                    >
                      {selected.archived ? '↩ повернути з архіву' : '🗄 в архів'}
                    </button>
                  </span>
                </div>
                <ChatTab orderId={selected.orderId} />
              </div>
            ) : (
              <div
                className="wfp-mono"
                style={{
                  fontSize: 12,
                  color: 'var(--wf-fg-muted)',
                  border: '1px dashed var(--wf-border)',
                  borderRadius: 'var(--wf-radius)',
                  padding: 40,
                  textAlign: 'center',
                }}
              >
                // оберіть розмову зліва
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
