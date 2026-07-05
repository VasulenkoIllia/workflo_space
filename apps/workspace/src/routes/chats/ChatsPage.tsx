import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useCommentStream } from '@workflo/app-core'
import { EmptyState, Skeleton } from '@workflo/ui'
import { useConversations, useSetConversationState, type Conversation } from '@/lib/chats'
import { ChatTab } from '@/routes/orders/ChatTab'

/**
 * «Чати» (18-А, рішення власника 05.07): єдиний хаб розмов. Master-detail —
 * зліва треди, згруповані КЛІЄНТ → замовлення (канон групування), з unread-бейджами
 * і прев'ю; праворуч повний чат замовлення (спільний <ChatTab> з mute/відповідальним).
 * Фільтри «всі / мої / без відповіді / архів» — по прапорцях list-ендпоінта.
 */
type Filter = 'all' | 'mine' | 'unanswered' | 'archived'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'всі' },
  { id: 'mine', label: 'мої' },
  { id: 'unanswered', label: 'без відповіді' },
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
          {c.title}
        </span>
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
            gridTemplateColumns: 'minmax(260px, 340px) 1fr',
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
                      onClick={() => select(c.orderId)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          <div style={{ minWidth: 0 }}>
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
                  <Link
                    to={`/orders/${selected.orderId}`}
                    style={{ fontSize: 15, fontWeight: 600, color: 'var(--wf-fg)' }}
                  >
                    {selected.title} ↗
                  </Link>
                  <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                    {selected.companyName ?? 'внутрішнє'}
                  </span>
                  <button
                    type="button"
                    className="wfp-link"
                    style={{ fontSize: 12, marginLeft: 'auto' }}
                    onClick={toggleArchive}
                    disabled={setConvState.isPending}
                  >
                    {selected.archived ? '↩ повернути з архіву' : '🗄 в архів'}
                  </button>
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
