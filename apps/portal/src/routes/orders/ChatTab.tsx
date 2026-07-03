import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, Button, Icon, cn } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import {
  downloadFile,
  markCommentsRead,
  useComments,
  usePostComment,
  useUploadFile,
  type ChatComment,
  type CommentAttachment,
} from '@/lib/orderDetail'
import { formatDateTime } from '@/lib/format'

export function ChatTab({ orderId }: { orderId: string }) {
  const { user } = useAuth()
  const myId = user?.profile.id
  const { data, isLoading } = useComments(orderId)
  const post = usePostComment(orderId)
  const upload = useUploadFile(orderId)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatComment | null>(null)
  const [attach, setAttach] = useState<CommentAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const pickFiles = async (list: FileList | null) => {
    if (!list?.length) return
    // Файли вантажаться одразу (стають OrderFile) і чекають чіпсами до «Надіслати».
    for (const file of Array.from(list).slice(0, 10 - attach.length)) {
      try {
        const r = await upload.mutateAsync(file)
        setAttach((prev) => [...prev, r.file])
      } catch {
        toast.error(`Не вдалося завантажити «${file.name}»`)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const send = () => {
    const content = text.trim()
    if ((!content && attach.length === 0) || post.isPending || upload.isPending) return
    post.mutate(
      {
        content,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
        ...(attach.length ? { fileIds: attach.map((a) => a.id) } : {}),
      },
      {
        onSuccess: () => {
          setText('')
          setReplyTo(null)
          setAttach([])
        },
      }
    )
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
              <span
                className={cn('wfp-chat-who', mine && 'wfp-chat-who--client')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}
              >
                <Avatar name={c.author.name} size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mine ? 'ви' : c.author.name}
                </span>
                {!mine && <RoleBadge kind={c.author.kind} />}
              </span>
              <div className="wfp-chat-text">
                {c.replyTo && <ReplyQuote replyTo={c.replyTo} />}
                {c.content}
                <button
                  type="button"
                  className="wfp-mono"
                  title="Відповісти"
                  onClick={() => setReplyTo(c)}
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--wf-fg-muted)',
                  }}
                >
                  ↩
                </button>
                <AttachmentChips items={c.attachments ?? []} />
              </div>
            </div>
          )
        })
      )}
      <div className="wfp-chat-input">
        <span className="wfp-chat-input-ts">зараз</span>
        <span className="wfp-chat-input-who">ви</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <ComposerExtras
            replyTo={replyTo}
            attach={attach}
            uploading={upload.isPending}
            onCancelReply={() => setReplyTo(null)}
            onRemoveAttach={(id) => setAttach((prev) => prev.filter((a) => a.id !== id))}
          />
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
        </div>
        <div className="wfp-chat-input-actions">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => void pickFiles(e.target.files)}
          />
          <Button
            variant="ghost"
            size="sm"
            title="Прикріпити файл"
            loading={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Icon name="file" size={12} />}
          >
            Файл
          </Button>
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

/** Reply-прев'ю в баблі: SetNull-оригінал / прихований → «повідомлення видалено». */
export function ReplyQuote({ replyTo }: { replyTo: NonNullable<ChatComment['replyTo']> }) {
  return (
    <div
      style={{
        borderLeft: '2px solid var(--wf-accent)',
        padding: '2px 8px',
        marginBottom: 4,
        fontSize: 11,
        color: 'var(--wf-fg-muted)',
        background: 'color-mix(in oklab, var(--wf-accent) 6%, transparent)',
        borderRadius: '0 4px 4px 0',
      }}
    >
      {replyTo.preview != null ? (
        <>
          <span style={{ fontWeight: 600, color: 'var(--wf-fg)' }}>{replyTo.authorName}</span> ·{' '}
          {replyTo.preview}
        </>
      ) : (
        <em>повідомлення видалено</em>
      )}
    </div>
  )
}

export function AttachmentChips({ items }: { items: CommentAttachment[] }) {
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          className="wfp-mono"
          title={`Завантажити · ${Math.max(1, Math.round(a.sizeBytes / 1024))} КБ`}
          onClick={() => void downloadFile(a).catch(() => toast.error('Не вдалося завантажити'))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid var(--wf-border)',
            background: 'var(--wf-surface)',
            color: 'var(--wf-fg)',
            cursor: 'pointer',
            maxWidth: 220,
          }}
        >
          <Icon name="file" size={11} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.filename}
          </span>
          <Icon name="download" size={10} />
        </button>
      ))}
    </div>
  )
}

/** Рядок над інпутом: reply-цитата (скасовується) + чіпи ще-не-надісланих вкладень. */
export function ComposerExtras({
  replyTo,
  attach,
  uploading,
  onCancelReply,
  onRemoveAttach,
}: {
  replyTo: ChatComment | null
  attach: CommentAttachment[]
  uploading: boolean
  onCancelReply: () => void
  onRemoveAttach: (id: string) => void
}) {
  if (!replyTo && attach.length === 0 && !uploading) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      {replyTo && (
        <span
          className="wfp-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            borderLeft: '2px solid var(--wf-accent)',
            background: 'color-mix(in oklab, var(--wf-accent) 8%, transparent)',
            color: 'var(--wf-fg-muted)',
            maxWidth: 320,
          }}
        >
          ↩ {replyTo.author.name}:{' '}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {replyTo.content.slice(0, 60)}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            title="Скасувати відповідь"
          >
            <Icon name="close" size={10} />
          </button>
        </span>
      )}
      {attach.map((a) => (
        <span
          key={a.id}
          className="wfp-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px dashed var(--wf-border)',
            color: 'var(--wf-fg)',
            maxWidth: 220,
          }}
        >
          <Icon name="file" size={11} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.filename}
          </span>
          <button
            type="button"
            onClick={() => onRemoveAttach(a.id)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            title="Прибрати з повідомлення (файл лишиться у «Файлах»)"
          >
            <Icon name="close" size={10} />
          </button>
        </span>
      ))}
      {uploading && (
        <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // завантаження…
        </span>
      )}
    </div>
  )
}

function RoleBadge({ kind }: { kind: 'team' | 'client' }) {
  const team = kind === 'team'
  return (
    <span
      className="wfp-mono"
      style={{
        fontSize: 9,
        lineHeight: 1.4,
        padding: '0 5px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        background: team ? 'color-mix(in oklab, var(--wf-accent) 18%, transparent)' : 'transparent',
        border: team ? 'none' : '1px solid var(--wf-border)',
        color: team ? 'var(--wf-fg)' : 'var(--wf-fg-muted)',
      }}
    >
      {team ? 'команда' : 'клієнт'}
    </span>
  )
}
