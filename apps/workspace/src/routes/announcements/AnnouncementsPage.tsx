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

      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </div>
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
