import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, Button, Icon, cn } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import {
  downloadFile,
  markCommentsRead,
  useComments,
  useParticipants,
  usePostComment,
  useUploadFile,
  type ChatComment,
  type ChatParticipant,
  type ReadMarker,
} from '@/lib/orderDetail'
import type { CommentAttachment } from '@/lib/orderDetail'
import { formatDateTime } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { REACTION_EMOJIS } from '@workflo/types'
import {
  fetchFileBlobUrl,
  sendTyping,
  useDeleteComment,
  usePinComment,
  useSearchComments,
  useToggleReaction,
  useUpdateComment,
  type TypingMarker,
} from '@/lib/orderDetail'

// Канон 03-B: автор редагує 15 хв; owner агенції — будь-коли (бек енфорсить).
const EDIT_WINDOW_MS = 15 * 60 * 1000

/** Хвіст «@запит» у композері (згадка набирається в кінці тексту). */
const MENTION_TAIL = /@([^\s@]{0,30})$/u

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Підсвітити точні @Ім'я-токени відомих учасників у тексті повідомлення. */
function MentionText({ content, names }: { content: string; names: string[] }) {
  if (names.length === 0 || !content.includes('@')) return <>{content}</>
  const tokens = names.map((n) => `@${n}`).sort((a, b) => b.length - a.length)
  const re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gu')
  const known = new Set(tokens)
  return (
    <>
      {content.split(re).map((part, i) =>
        known.has(part) ? (
          <span
            key={i}
            style={{
              color: 'var(--wf-accent)',
              fontWeight: 600,
              background: 'color-mix(in oklab, var(--wf-accent) 10%, transparent)',
              borderRadius: 4,
              padding: '0 2px',
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/** ✓ надіслано / ✓✓ прочитано (S10) — тултип перелічує, хто вже прочитав. */
function ReadTicks({ createdAt, reads }: { createdAt: string; reads: ReadMarker[] }) {
  const readers = reads.filter((r) => new Date(r.lastReadAt) >= new Date(createdAt))
  const seen = readers.length > 0
  return (
    <span
      className="wfp-mono"
      title={seen ? `Прочитано: ${readers.map((r) => r.name).join(', ')}` : 'Надіслано'}
      style={{
        marginLeft: 6,
        fontSize: 10,
        color: seen ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
        cursor: 'default',
      }}
    >
      {seen ? '✓✓' : '✓'}
    </span>
  )
}

/** Випадачка @-автокомпліту над композером. */
function MentionDropdown({
  options,
  onPick,
}: {
  options: ChatParticipant[]
  onPick: (p: ChatParticipant) => void
}) {
  if (options.length === 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        zIndex: 20,
        minWidth: 220,
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 8,
        boxShadow: '0 6px 24px rgba(0,0,0,.25)',
        overflow: 'hidden',
      }}
    >
      {options.map((p) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault() // не втрачати фокус інпута
            onPick(p)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--wf-fg)',
            fontSize: 13,
            textAlign: 'left',
          }}
        >
          <Avatar name={p.name} size={16} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <span className="wfp-mono" style={{ fontSize: 9, color: 'var(--wf-fg-muted)' }}>
            {p.kind === 'team' ? 'команда' : 'клієнт'}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Internal-team chat: shows client + internal notes, with an "internal" toggle on send,
 * reply-to quoting and file attachments (03-чат, зріз 03.07). */

/** Чіпи реакцій + «+»-пікер з технічного набору REACTION_EMOJIS (S10, канон 03-C). */
function ReactionBar({
  comment,
  onToggle,
}: {
  comment: ChatComment
  onToggle: (emoji: string, mine: boolean) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const reactions = comment.reactions ?? []
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginTop: 4, marginRight: 6 }}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className="wfp-mono"
          title={r.names.join(', ')}
          onClick={() => onToggle(r.emoji, r.mine)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 999,
            cursor: 'pointer',
            border: r.mine ? '1px solid var(--wf-accent)' : '1px solid var(--wf-border)',
            background: r.mine
              ? 'color-mix(in oklab, var(--wf-accent) 14%, transparent)'
              : 'transparent',
            color: 'var(--wf-fg)',
          }}
        >
          {r.emoji} {r.count}
        </button>
      ))}
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          className="wfp-mono"
          title="Додати реакцію"
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 999,
            cursor: 'pointer',
            border: '1px dashed var(--wf-border)',
            background: 'transparent',
            color: 'var(--wf-fg-muted)',
          }}
        >
          +🙂
        </button>
        {pickerOpen && (
          <span
            style={{
              position: 'absolute',
              bottom: '110%',
              left: 0,
              zIndex: 20,
              display: 'flex',
              gap: 2,
              padding: '4px 6px',
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 8,
              boxShadow: '0 6px 24px rgba(0,0,0,.25)',
            }}
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  const mine = reactions.find((r) => r.emoji === e)?.mine ?? false
                  onToggle(e, mine)
                  setPickerOpen(false)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 15,
                  padding: 2,
                }}
              >
                {e}
              </button>
            ))}
          </span>
        )}
      </span>
    </div>
  )
}

/** «N друкує…» — ефемерний маркер з SSE, сам гасне по `until`. */
function TypingRow({ orderId }: { orderId: string }) {
  const qc = useQueryClient()
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const marker = qc.getQueryData<TypingMarker>(['order-typing', orderId])
  if (!marker || marker.until < Date.now()) return null
  return (
    <div
      className="wfp-mono"
      style={{ fontSize: 11, color: 'var(--wf-fg-muted)', padding: '2px 0' }}
    >
      {marker.name} друкує…
    </div>
  )
}

/** Секція «Закріплене» (03-Г): згорнутий список зверху чату. */
function PinnedSection({
  pinned,
  canPin,
  onUnpin,
}: {
  pinned: ChatComment[]
  canPin: boolean
  onUnpin: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (pinned.length === 0) return null
  return (
    <div
      style={{
        border: '1px solid var(--wf-border)',
        borderRadius: 8,
        padding: '6px 10px',
        marginBottom: 8,
        background: 'color-mix(in oklab, var(--wf-accent) 4%, transparent)',
      }}
    >
      <button
        type="button"
        className="wfp-mono"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: 11,
          color: 'var(--wf-fg-muted)',
          padding: 0,
        }}
      >
        📌 закріплене · {pinned.length} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          {pinned.map((c) => (
            <div
              key={c.id}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}
            >
              <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                {formatDateTime(c.createdAt)}
              </span>
              <span style={{ fontWeight: 600 }}>{c.author.name}:</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.content}
              </span>
              {canPin && (
                <button
                  type="button"
                  title="Відкріпити"
                  onClick={() => onUnpin(c.id)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--wf-fg-muted)',
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 03-МЕДІА: інлайн-рендер вкладень — картинки (прев'ю+лайтбокс) авто, аудіо/відео
 * плеєром ПІСЛЯ кліку (файл може бути до 100МБ — не тягнемо на відкриття чату). */
function MediaAttachments({ items }: { items: CommentAttachment[] }) {
  const media = items.filter((a) => /^(image|audio|video)\//.test(a.mimeType))
  const rest = items.filter((a) => !/^(image|audio|video)\//.test(a.mimeType))
  return (
    <>
      {media.map((a) => (
        <MediaItem key={a.id} file={a} />
      ))}
      <AttachmentChips items={rest} />
    </>
  )
}

function MediaItem({ file }: { file: CommentAttachment }) {
  const kind = file.mimeType.split('/')[0]
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  // Розмонтування під час on-demand завантаження (audio/video): без гарду
  // fetchFileBlobUrl уже створив blob-URL, а setUrl не встиг — cleanup нижче його
  // не бачить (url===null) → витік. mountedRef ревокає замість setState на мертвому.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = () => {
    if (url || loading) return
    setLoading(true)
    fetchFileBlobUrl(file)
      .then((u) => {
        if (mountedRef.current) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch(() => toast.error('Не вдалося завантажити медіа'))
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }
  // Картинки — одразу (fileId-залежність: об'єкт file міняється при рефетчі кешу).
  const fileId = file.id
  useEffect(() => {
    if (kind !== 'image') return
    let cancelled = false
    setLoading(true)
    fetchFileBlobUrl({ id: fileId })
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u)
        else setUrl(u)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [kind, fileId])
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  if (kind === 'image') {
    return (
      <div style={{ marginTop: 6 }}>
        {url ? (
          <img
            src={url}
            alt={file.filename}
            onClick={() => setLightbox(true)}
            style={{
              display: 'block',
              maxHeight: 180,
              maxWidth: 280,
              borderRadius: 8,
              border: '1px solid var(--wf-border)',
              cursor: 'zoom-in',
            }}
          />
        ) : (
          <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // {loading ? 'завантаження зображення…' : file.filename}
          </span>
        )}
        {lightbox && url && (
          <div
            onClick={() => setLightbox(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <img
              src={url}
              alt={file.filename}
              style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 8 }}
            />
          </div>
        )}
      </div>
    )
  }

  if (!url) {
    return (
      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          className="wfp-mono"
          onClick={load}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--wf-border)',
            background: 'var(--wf-surface)',
            color: 'var(--wf-fg)',
            cursor: 'pointer',
          }}
        >
          ▶{' '}
          {loading
            ? 'завантаження…'
            : `${kind === 'audio' ? 'аудіо' : 'відео'} · ${file.filename} · ${Math.max(1, Math.round(file.sizeBytes / 1024 / 1024))} МБ`}
        </button>
      </div>
    )
  }
  return kind === 'audio' ? (
    <audio
      controls
      autoPlay
      src={url}
      style={{ display: 'block', marginTop: 6, maxWidth: 320, height: 32 }}
    />
  ) : (
    <video
      controls
      autoPlay
      src={url}
      style={{ display: 'block', marginTop: 6, maxWidth: 360, maxHeight: 240, borderRadius: 8 }}
    />
  )
}

export function ChatTab({ orderId }: { orderId: string }) {
  const { user, isOwner } = useAuth()
  const myId = user?.profile.id
  const { data, isLoading } = useComments(orderId)
  const post = usePostComment(orderId)
  const upload = useUploadFile(orderId)
  const update = useUpdateComment(orderId)
  const del = useDeleteComment(orderId)
  const react = useToggleReaction(orderId)
  const pin = usePinComment(orderId)
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)
  // 03-В: пошук по коментарях замовлення (бек шукає ВСІ, не лише завантажену сторінку).
  const [searchQ, setSearchQ] = useState('')
  const search = useSearchComments(orderId, searchQ)
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)
  const [onlyInternal, setOnlyInternal] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatComment | null>(null)
  const [attach, setAttach] = useState<CommentAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const count = data?.comments.length ?? 0

  // @mention (S10): кандидати = учасники замовлення; у internal-режимі — лише команда.
  const participants = useParticipants(orderId).data ?? []
  const [mentions, setMentions] = useState<ChatParticipant[]>([])
  const mentionTail = text.match(MENTION_TAIL)?.[1] ?? null
  const mentionOptions =
    mentionTail != null
      ? participants
          .filter(
            (p) =>
              p.id !== myId &&
              (!internal || p.kind === 'team') &&
              p.name.toLowerCase().includes(mentionTail.toLowerCase())
          )
          .slice(0, 6)
      : []
  const pickMention = (p: ChatParticipant) => {
    setText((t) => t.replace(MENTION_TAIL, `@${p.name} `))
    setMentions((prev) => (prev.some((m) => m.id === p.id) ? prev : [...prev, p]))
  }
  const participantNames = participants.map((p) => p.name)
  const reads = data?.meta.reads ?? []

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

  const pickFiles = async (list: FileList | null) => {
    if (!list?.length) return
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
    // Згадка чинна, лише поки її @Ім'я досі в тексті (могли стерти вручну).
    const mentionIds = mentions.filter((m) => content.includes(`@${m.name}`)).map((m) => m.id)
    post.mutate(
      {
        content,
        isInternal: internal,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
        ...(attach.length ? { fileIds: attach.map((a) => a.id) } : {}),
        ...(mentionIds.length ? { mentionIds } : {}),
      },
      {
        onSuccess: () => {
          setText('')
          setReplyTo(null)
          setAttach([])
          setMentions([])
        },
      }
    )
  }

  const saveEdit = () => {
    if (!editing || !editing.content.trim() || update.isPending) return
    update.mutate(
      { commentId: editing.id, content: editing.content.trim() },
      {
        onSuccess: () => setEditing(null),
        onError: () => toast.error('Не вдалося зберегти (вікно 15 хв могло минути)'),
      }
    )
  }

  const comments = data?.comments ?? []
  const internalCount = comments.filter((c) => c.isInternal).length
  const baseShown = onlyInternal ? comments.filter((c) => c.isInternal) : comments
  const shown = searchQ.trim().length >= 2 ? (search.data ?? []) : baseShown
  const searching = searchQ.trim().length >= 2
  return (
    <div className="wfp-chat" ref={scrollRef}>
      <PinnedSection
        pinned={data?.pinned ?? []}
        canPin
        onUnpin={(id) => pin.mutate({ commentId: id, pinned: true })}
      />
      {comments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
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
          <input
            className="wfp-chat-input-field"
            placeholder="🔍 пошук у чаті…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{ marginLeft: 'auto', maxWidth: 200, fontSize: 12, padding: '3px 8px' }}
          />
        </div>
      )}
      {searching && (
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
        >
          // результати пошуку «{searchQ.trim()}» · {search.data?.length ?? '…'}{' '}
          <button
            type="button"
            className="wfp-link"
            style={{ fontSize: 11 }}
            onClick={() => setSearchQ('')}
          >
            скинути
          </button>
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
          const mentionedMe = !mine && myId != null && (c.mentions ?? []).includes(myId)
          return (
            <div
              key={c.id}
              className={cn('wfp-chat-row', c.isInternal && 'wfp-chat-row--internal')}
              style={
                mentionedMe
                  ? {
                      background: 'color-mix(in oklab, var(--wf-accent) 7%, transparent)',
                      borderLeft: '2px solid var(--wf-accent)',
                      borderRadius: 4,
                    }
                  : undefined
              }
            >
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
                {c.isInternal && ' 🔒'}
              </span>
              <div className="wfp-chat-text">
                {c.replyTo && <ReplyQuote replyTo={c.replyTo} />}
                {editing?.id === c.id ? (
                  <span
                    style={{ display: 'inline-flex', gap: 6, alignItems: 'center', width: '100%' }}
                  >
                    <input
                      className="wfp-chat-input-field"
                      style={{ flex: 1 }}
                      value={editing.content}
                      autoFocus
                      onChange={(e) => setEditing({ id: c.id, content: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveEdit()
                        }
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      loading={update.isPending}
                      onClick={saveEdit}
                    >
                      Зберегти
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Скасувати
                    </Button>
                  </span>
                ) : (
                  <>
                    <MentionText content={c.content} names={participantNames} />
                    {c.editedAt && (
                      <span
                        className="wfp-mono"
                        style={{ marginLeft: 5, fontSize: 10, color: 'var(--wf-fg-muted)' }}
                      >
                        (відредаговано)
                      </span>
                    )}
                    {mine && <ReadTicks createdAt={c.createdAt} reads={reads} />}
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
                    {((mine && Date.now() - new Date(c.createdAt).getTime() < EDIT_WINDOW_MS) ||
                      isOwner) && (
                      <button
                        type="button"
                        className="wfp-mono"
                        title="Редагувати"
                        onClick={() => setEditing({ id: c.id, content: c.content })}
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--wf-fg-muted)',
                        }}
                      >
                        ✎
                      </button>
                    )}
                    {(mine || isOwner) && (
                      <button
                        type="button"
                        className="wfp-mono"
                        title="Видалити"
                        onClick={() => {
                          del.mutate(c.id, {
                            onError: () => toast.error('Не вдалося видалити'),
                          })
                        }}
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--wf-fg-muted)',
                        }}
                      >
                        🗑
                      </button>
                    )}
                    <button
                      type="button"
                      className="wfp-mono"
                      title={c.pinnedAt ? 'Відкріпити' : 'Закріпити'}
                      onClick={() =>
                        pin.mutate(
                          { commentId: c.id, pinned: !!c.pinnedAt },
                          { onError: () => toast.error('Не вдалося') }
                        )
                      }
                      style={{
                        marginLeft: 4,
                        fontSize: 11,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: c.pinnedAt ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
                      }}
                    >
                      📌
                    </button>
                  </>
                )}
                <MediaAttachments items={c.attachments ?? []} />
                <ReactionBar
                  comment={c}
                  onToggle={(emoji, mine2) =>
                    react.mutate(
                      { commentId: c.id, emoji, mine: mine2 },
                      { onError: () => toast.error('Не вдалося') }
                    )
                  }
                />
              </div>
            </div>
          )
        })
      )}
      <TypingRow orderId={orderId} />
      <div className="wfp-chat-input">
        <span className="wfp-chat-input-ts">зараз</span>
        <span className="wfp-chat-input-who">ви</span>
        <div style={{ minWidth: 0, flex: 1, position: 'relative' }}>
          <MentionDropdown options={mentionOptions} onPick={pickMention} />
          <ComposerExtras
            replyTo={replyTo}
            attach={attach}
            uploading={upload.isPending}
            onCancelReply={() => setReplyTo(null)}
            onRemoveAttach={(id) => setAttach((prev) => prev.filter((a) => a.id !== id))}
          />
          <input
            className="wfp-chat-input-field"
            placeholder={
              internal
                ? 'внутрішня нотатка (клієнт не бачить)…'
                : 'Напишіть повідомлення… (@ — згадати)'
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (e.target.value) sendTyping(orderId, internal)
            }}
            onKeyDown={(e) => {
              // Відкрита @-випадачка: Enter/Tab підставляє першого кандидата.
              if (mentionOptions.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
                e.preventDefault()
                pickMention(mentionOptions[0] as ChatParticipant)
                return
              }
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

/** Reply-прев'ю в баблі: SetNull-оригінал / прихована нотатка → «повідомлення видалено». */
function ReplyQuote({ replyTo }: { replyTo: NonNullable<ChatComment['replyTo']> }) {
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

function AttachmentChips({ items }: { items: CommentAttachment[] }) {
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
function ComposerExtras({
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
