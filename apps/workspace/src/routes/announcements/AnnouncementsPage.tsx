import { useState } from 'react'
import { toast } from 'sonner'
import { Button, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { ApiError } from '@/lib/api'
import {
  type AnnouncementAudience,
  useAnnouncementsAdmin,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from '@/lib/announcements'
import {
  BROADCAST_STATUS_LABEL,
  SEGMENT_LABEL,
  TIER_LABEL,
  useBroadcastPreview,
  useBroadcasts,
  useDeleteBroadcast,
  useSaveBroadcast,
  useSendBroadcast,
  type Broadcast,
  type BroadcastSegment,
  type LoyaltyTier,
} from '@/lib/broadcasts'
import { Card } from '@workflo/ui'
import { formatDate } from '@/lib/format'

/**
 * ANNOUNCEMENTS (07-В, owner): оголошення агенції — sticky-банер у workspace (team/all)
 * і порталі (clients/all). Створення=чернетка → publish; ✕ банера в юзера = read-receipt,
 * тут видно % прочитань по цільовій аудиторії. Архів ховає банер у всіх.
 */
const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  team: 'команда',
  clients: 'клієнти',
  all: 'усі',
}

export function AnnouncementsPage() {
  const { data: items = [], isLoading } = useAnnouncementsAdmin()
  const update = useUpdateAnnouncement()
  const del = useDeleteAnnouncement()
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Оголошення</div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 20 }}
          >
            // sticky-банер команді та клієнтам · ✕ у юзера = прочитано
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Оголошення
        </Button>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <EmptyState
          glyph="// 📣"
          title="Оголошень ще немає"
          description="Створи перше — після публікації воно з'явиться банером у цільової аудиторії."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr auto auto auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
                opacity: a.archivedAt ? 0.55 : 1,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.title}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--wf-fg-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={a.body}
                >
                  {a.body}
                </div>
              </span>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                → {AUDIENCE_LABEL[a.audience]}
              </span>
              <span
                className="wfp-mono"
                style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}
                title={`${a.readCount} з ${a.targetCount} прочитали`}
              >
                {a.readPct != null ? `${a.readPct}% прочитано` : '—'}
              </span>
              <span
                className={`wfp-badge wfp-badge--${
                  a.archivedAt ? 'muted' : a.published ? 'success' : 'muted'
                }`}
              >
                {a.archivedAt ? 'архів' : a.published ? 'активне' : 'чернетка'}
              </span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                {!a.archivedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: a.id, published: !a.published },
                        {
                          onSuccess: () =>
                            toast.success(a.published ? 'Знято з публікації' : 'Опубліковано'),
                        }
                      )
                    }
                  >
                    {a.published ? 'зняти' : 'опублікувати'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update.mutate(
                      { id: a.id, archived: !a.archivedAt },
                      {
                        onSuccess: () =>
                          toast.success(a.archivedAt ? 'Повернуто з архіву' : 'Заархівовано'),
                      }
                    )
                  }
                >
                  {a.archivedAt ? 'відновити' : 'архів'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`Видалити «${a.title}»?`)) return
                    del.mutate(a.id, { onSuccess: () => toast.success('Видалено') })
                  }}
                >
                  ✕
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* S12-07: email-розсилки сегменту клієнтів */}
      <div style={{ marginTop: 24 }}>
        <BroadcastsSection />
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </div>
  )
}

/** S12-07: розсилки — список + модалка створення + preview + send. */
function BroadcastsSection() {
  const { data, isLoading } = useBroadcasts()
  const send = useSendBroadcast()
  const del = useDeleteBroadcast()
  const [editing, setEditing] = useState<Broadcast | null | 'new'>(null)
  const items = data?.broadcasts ?? []

  return (
    <Card
      title="Email-розсилки"
      aux={
        <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
          + Розсилка
        </Button>
      }
    >
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // лист власникам компаній сегмента · доставка поважає їхні налаштування сповіщень
      </div>
      {isLoading ? (
        <Skeleton style={{ height: 100 }} />
      ) : items.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // розсилок ще не було
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {items.map((b) => (
            <div
              key={b.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr auto auto auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{b.subject}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--wf-fg-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={b.body}
                >
                  {b.body}
                </div>
              </span>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                → {SEGMENT_LABEL[b.segment]}
                {b.segment === 'tier' && b.tier ? ` · ${TIER_LABEL[b.tier]}` : ''}
              </span>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                {b.status === 'sent'
                  ? `${b.sentCount} одерж. · ${b.sentAt ? formatDate(b.sentAt) : ''}`
                  : '—'}
              </span>
              <span
                className={`wfp-badge wfp-badge--${
                  b.status === 'sent' ? 'success' : b.status === 'sending' ? 'warning' : 'muted'
                }`}
              >
                {BROADCAST_STATUS_LABEL[b.status]}
              </span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                {b.status === 'draft' && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                      Редагувати
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        del.mutate(b.id, { onSuccess: () => toast.success('Видалено') })
                      }
                    >
                      ✕
                    </Button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <BroadcastModal
          broadcast={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSend={(id) =>
            send.mutate(id, {
              onSuccess: () => {
                toast.success('Розсилку поставлено в чергу — листи підуть за хвилину')
                setEditing(null)
              },
              onError: (err) =>
                toast.error(err instanceof ApiError ? err.message : 'Не вдалося надіслати'),
            })
          }
        />
      )}
    </Card>
  )
}

function BroadcastModal({
  broadcast,
  onClose,
  onSend,
}: {
  broadcast: Broadcast | null
  onClose: () => void
  onSend: (id: string) => void
}) {
  const save = useSaveBroadcast()
  const [subject, setSubject] = useState(broadcast?.subject ?? '')
  const [body, setBody] = useState(broadcast?.body ?? '')
  const [segment, setSegment] = useState<BroadcastSegment>(broadcast?.segment ?? 'all')
  const [tier, setTier] = useState<LoyaltyTier>(broadcast?.tier ?? 'vip')
  const [savedId, setSavedId] = useState<string | null>(broadcast?.id ?? null)
  const preview = useBroadcastPreview(savedId)
  const valid = subject.trim().length >= 3 && body.trim().length >= 10

  const persist = (then?: (id: string) => void) =>
    save.mutate(
      {
        id: savedId ?? undefined,
        subject: subject.trim(),
        body: body.trim(),
        segment,
        tier: segment === 'tier' ? tier : null,
      },
      {
        onSuccess: (r) => {
          setSavedId(r.broadcast.id)
          then?.(r.broadcast.id)
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : 'Не вдалося зберегти'),
      }
    )

  return (
    <Modal
      open
      title={savedId ? 'Розсилка (чернетка)' : 'Нова розсилка'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Закрити
          </Button>
          <Button
            variant="secondary"
            loading={save.isPending}
            disabled={!valid}
            onClick={() => persist()}
          >
            Зберегти чернетку
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={save.isPending}
            onClick={() =>
              persist((id) => {
                const n = preview.data?.recipientCount
                if (
                  window.confirm(
                    `Надіслати розсилку${n != null ? ` ${n} одержувачам` : ''}? Скасувати буде неможливо.`
                  )
                )
                  onSend(id)
              })
            }
          >
            Надіслати
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <Input label="Тема листа" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          Текст (порожній рядок = новий абзац)
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            style={{ width: '100%', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: segment === 'tier' ? '1fr 1fr' : '1fr',
            gap: 10,
          }}
        >
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            Сегмент
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as BroadcastSegment)}
              style={{ padding: 8 }}
            >
              <option value="all">Усі клієнти</option>
              <option value="debtors">Боржники (борг {'>'} 0)</option>
              <option value="tier">Loyalty-тір…</option>
            </select>
          </label>
          {segment === 'tier' && (
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              Тір
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as LoyaltyTier)}
                style={{ padding: 8 }}
              >
                {(Object.keys(TIER_LABEL) as LoyaltyTier[]).map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {savedId && (
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-accent)' }}>
            // отримають: {preview.isLoading ? '…' : (preview.data?.recipientCount ?? '—')}{' '}
            власників компаній
          </div>
        )}
      </div>
    </Modal>
  )
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAnnouncement()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('all')

  return (
    <Modal open title="Нове оголошення" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Input label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          Текст
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            style={{ width: '100%', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          Аудиторія
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
            style={{ padding: 8 }}
          >
            <option value="all">Усі (команда + клієнти)</option>
            <option value="team">Лише команда</option>
            <option value="clients">Лише клієнти</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={title.trim().length < 3 || body.trim().length < 3}
            onClick={() =>
              create.mutate(
                { title: title.trim(), body: body.trim(), audience },
                {
                  onSuccess: () => {
                    toast.success('Чернетку створено — опублікуй, щоб показати банер')
                    onClose()
                  },
                  onError: (err) =>
                    toast.error(err instanceof ApiError ? err.message : 'Не вдалося створити'),
                }
              )
            }
          >
            Створити чернетку
          </Button>
        </div>
      </div>
    </Modal>
  )
}
