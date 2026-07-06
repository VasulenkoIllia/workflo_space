import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useCommentStream } from '@workflo/app-core'
import { EmptyState, Skeleton } from '@workflo/ui'
import { useConversations, useSetConversationState, type PortalConversation } from '@/lib/chats'
import { ChatTab } from '@/routes/orders/ChatTab'

/**
 * «Чати» в порталі (18-А): всі розмови моїх замовлень одним списком. Master-detail,
 * як у workspace-хабі, але клієнтський субсет: без відповідального/«без відповіді»,
 * лише публічні повідомлення (бек фільтрує), фільтри «всі / архів».
 */
type Filter = 'all' | 'archived'

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

const timeShort = (iso: string): string => {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

function ThreadRow({
  c,
  active,
  onClick,
}: {
  c: PortalConversation
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
          {c.lastMessage.isMine ? 'Ви' : c.lastMessage.authorName}: {c.lastMessage.preview}
        </div>
      )}
    </button>
  )
}

export function ChatsPage() {
  const { data, isLoading } = useConversations()
  const qc = useQueryClient()
  const isNarrow = useIsNarrow()
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useCommentStream(selectedId ?? '')
  const setConvState = useSetConversationState(selectedId ?? '')

  const rows = useMemo(
    () =>
      (data?.conversations ?? []).filter((c) => (filter === 'archived' ? c.archived : !c.archived)),
    [data, filter]
  )
  const selected = rows.find((c) => c.orderId === selectedId) ?? null
  const unreadTotal = (data?.conversations ?? []).reduce(
    (s, c) => s + (c.archived ? 0 : c.unread),
    0
  )

  const select = (id: string) => {
    setSelectedId(id)
    setTimeout(() => void qc.invalidateQueries({ queryKey: ['portal-conversations'] }), 1500)
  }

  const toggleArchive = () => {
    if (!selected) return
    setConvState.mutate(
      { archived: !selected.archived },
      {
        onSuccess: () =>
          toast.success(selected.archived ? 'Розмову повернено' : 'Розмову архівовано'),
      }
    )
  }

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Чати</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 16 }}
      >
        // розмови по ваших замовленнях{unreadTotal > 0 ? ` · непрочитаних: ${unreadTotal}` : ''}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(
          [
            { id: 'all', label: 'всі' },
            { id: 'archived', label: 'архів' },
          ] as { id: Filter; label: string }[]
        ).map((f) => (
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
          description="Напишіть у чат будь-якого замовлення — розмова зʼявиться тут."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : 'minmax(240px, 320px) 1fr',
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
              rows.map((c) => (
                <ThreadRow
                  key={c.orderId}
                  c={c}
                  active={c.orderId === selectedId}
                  onClick={() => select(c.orderId)}
                />
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
