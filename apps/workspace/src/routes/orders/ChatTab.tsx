import { useEffect, useRef, useState } from 'react'
import { Button, Icon, cn } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { markCommentsRead, useComments, usePostComment } from '@/lib/orderDetail'
import { formatDateTime } from '@/lib/format'

/** Internal-team chat: shows client + internal notes, with an "internal" toggle on send. */
export function ChatTab({ orderId }: { orderId: string }) {
  const { user } = useAuth()
  const myId = user?.profile.id
  const { data, isLoading } = useComments(orderId)
  const post = usePostComment(orderId)
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)
  const [onlyInternal, setOnlyInternal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const count = data?.comments.length ?? 0

  // Mark read once per order open — NOT on every count change, or each inbound SSE message would
  // re-POST and prematurely mark unseen messages read.
  useEffect(() => {
    markCommentsRead(orderId).catch(() => {
      /* non-critical; unread re-syncs on next open */
    })
  }, [orderId])

  useEffect(() => {
    const el = scrollRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      el.scrollTop = el.scrollHeight
    }
  }, [count])

  const send = () => {
    const content = text.trim()
    if (!content || post.isPending) return
    post.mutate({ content, isInternal: internal }, { onSuccess: () => setText('') })
  }

  const comments = data?.comments ?? []
  const internalCount = comments.filter((c) => c.isInternal).length
  const shown = onlyInternal ? comments.filter((c) => c.isInternal) : comments
  return (
    <div className="wfp-chat" ref={scrollRef}>
      {comments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <FilterBtn
            label={`Усі · ${comments.length}`}
            active={!onlyInternal}
            onClick={() => setOnlyInternal(false)}
          />
          <FilterBtn
            label={`🔒 внутрішні · ${internalCount}`}
            active={onlyInternal}
            onClick={() => setOnlyInternal(true)}
          />
        </div>
      )}
      {isLoading ? (
        <div className="wfp-chat-row">
          <span />
          <span />
          <span style={{ color: 'var(--wf-fg-muted)' }}>// завантаження…</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="wfp-chat-row">
          <span />
          <span />
          <span style={{ color: 'var(--wf-fg-muted)' }}>
            // повідомлень ще немає — напишіть першим
          </span>
        </div>
      ) : shown.length === 0 ? (
        <div className="wfp-chat-row">
          <span />
          <span />
          <span style={{ color: 'var(--wf-fg-muted)' }}>// немає внутрішніх нотаток</span>
        </div>
      ) : (
        shown.map((c) => {
          const mine = c.author.id === myId
          return (
            <div
              key={c.id}
              className={cn('wfp-chat-row', c.isInternal && 'wfp-chat-row--internal')}
            >
              <span className="wfp-chat-ts">{formatDateTime(c.createdAt)}</span>
              <span className={cn('wfp-chat-who', mine && 'wfp-chat-who--client')}>
                {mine ? 'ви' : c.author.name}
                {c.isInternal && ' 🔒'}
              </span>
              <div className="wfp-chat-text">{c.content}</div>
            </div>
          )
        })
      )}
      <div className="wfp-chat-input">
        <span className="wfp-chat-input-ts">зараз</span>
        <span className="wfp-chat-input-who">ви</span>
        <input
          className="wfp-chat-input-field"
          placeholder={
            internal ? 'внутрішня нотатка (клієнт не бачить)…' : 'Напишіть повідомлення…'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="wfp-chat-input-actions">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: internal ? 'var(--wf-warning)' : 'var(--wf-fg-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
            }}
            title="Внутрішня нотатка — видима лише команді"
          >
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
            />
            🔒 internal
          </label>
          <Button
            variant="primary"
            size="sm"
            loading={post.isPending}
            onClick={send}
            leftIcon={<Icon name="send" size={12} />}
          >
            Надіслати
          </Button>
        </div>
      </div>
    </div>
  )
}

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="wfp-mono"
      style={{
        fontSize: 11,
        padding: '3px 9px',
        borderRadius: 999,
        cursor: 'pointer',
        border: '1px solid var(--wf-border)',
        background: active
          ? 'color-mix(in oklab, var(--wf-accent) 14%, transparent)'
          : 'transparent',
        color: active ? 'var(--wf-fg)' : 'var(--wf-fg-muted)',
      }}
    >
      {label}
    </button>
  )
}
