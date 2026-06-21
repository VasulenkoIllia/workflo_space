import { useEffect, useRef, useState } from 'react'
import { Button, Icon, cn } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { markCommentsRead, useComments, usePostComment } from '@/lib/orderDetail'
import { formatDateTime } from '@/lib/format'

export function ChatTab({ orderId }: { orderId: string }) {
  const { user } = useAuth()
  const myId = user?.profile.id
  const { data, isLoading } = useComments(orderId)
  const post = usePostComment(orderId)
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const count = data?.comments.length ?? 0

  // Mark read once per order open — NOT on every count change, or each inbound SSE message
  // (the live stream lives at page level) would re-POST and mark unseen messages read.
  useEffect(() => {
    markCommentsRead(orderId).catch(() => {
      /* non-critical; unread re-syncs on next open */
    })
  }, [orderId])

  // Auto-scroll to the latest message, but only if the user is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      el.scrollTop = el.scrollHeight
    }
  }, [count])

  const send = () => {
    const content = text.trim()
    if (!content || post.isPending) return
    post.mutate(content, { onSuccess: () => setText('') })
  }

  const comments = data?.comments ?? []
  return (
    <div className="wfp-chat" ref={scrollRef}>
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
      ) : (
        comments.map((c) => {
          const mine = c.author.id === myId
          return (
            <div key={c.id} className="wfp-chat-row">
              <span className="wfp-chat-ts">{formatDateTime(c.createdAt)}</span>
              <span className={cn('wfp-chat-who', mine && 'wfp-chat-who--client')}>
                {mine ? 'ви' : c.author.name}
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
          placeholder="Напишіть повідомлення…"
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
