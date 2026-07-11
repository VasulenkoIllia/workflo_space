import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Input, Modal, Skeleton, Tabs } from '@workflo/ui'
import { ApiError } from '@/lib/api'
import {
  type BlogDraft,
  type CmsPostInput,
  type CmsPostRow,
  type Testimonial,
  type TestimonialInput,
  useCreateTestimonial,
  useDeleteTestimonial,
  useTestimonials,
  useUpdateTestimonial,
  blocksToText,
  textToBlocks,
  useCmsPost,
  useCmsPosts,
  useCreateCmsPost,
  useDeleteCmsPost,
  useGenerateDraft,
  usePublishCmsPost,
  useUpdateCmsPost,
} from '@/lib/content'

/**
 * S7-05 МІНІ-CMS (owner-only): блог + кейси лендінга. Список постів (чернетки й
 * опубліковані) + редактор: двомовні title/excerpt, контент міні-markdown-ом
 * (`##` секція · `-` список · `>` цитата · `!` callout · ``` код), теги, тип,
 * featured. Publish/unpublish керує видимістю на лендінгу (/blog, /cases).
 * AI-чернетка — з теми (потрібен ANTHROPIC_API_KEY на API).
 */
const TYPE_LABEL: Record<CmsPostRow['type'], string> = {
  article: 'стаття',
  case_study: 'кейс',
}

interface FormState {
  slug: string
  type: 'article' | 'case_study'
  titleUk: string
  titleEn: string
  excerptUk: string
  excerptEn: string
  textUk: string
  textEn: string
  tags: string
  featured: boolean
}

const EMPTY: FormState = {
  slug: '',
  type: 'article',
  titleUk: '',
  titleEn: '',
  excerptUk: '',
  excerptEn: '',
  textUk: '',
  textEn: '',
  tags: '',
  featured: false,
}

function toInput(f: FormState): CmsPostInput {
  return {
    slug: f.slug.trim(),
    type: f.type,
    titleUk: f.titleUk.trim(),
    titleEn: f.titleEn.trim(),
    excerptUk: f.excerptUk.trim(),
    excerptEn: f.excerptEn.trim(),
    contentUk: textToBlocks(f.textUk),
    contentEn: textToBlocks(f.textEn),
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    featured: f.featured,
  }
}

export function ContentPage() {
  const { data: posts = [], isLoading } = useCmsPosts()
  // 'new' — сентинел створення; будь-який інший рядок — id поста
  const [editingId, setEditingId] = useState<string | null>(null)
  // TESTIMONIALS: другий таб контенту — відгуки лендінга
  const [section, setSection] = useState('posts')
  const publish = usePublishCmsPost()
  const del = useDeleteCmsPost()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Контент</div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 20 }}
          >
            // блог · кейси · відгуки лендінга — чернетки і публікації
          </div>
        </div>
        {section === 'posts' && (
          <Button variant="primary" onClick={() => setEditingId('new')}>
            + Пост
          </Button>
        )}
      </div>

      <Tabs
        value={section}
        onChange={setSection}
        items={[
          { id: 'posts', label: 'Пости' },
          { id: 'testimonials', label: 'Відгуки' },
        ]}
      />

      {section === 'testimonials' ? (
        <TestimonialsSection />
      ) : isLoading ? (
        <Skeleton style={{ height: 220 }} />
      ) : posts.length === 0 ? (
        <EmptyState
          glyph="// cms"
          title="Постів ще немає"
          description="Створи перший пост або кейс — опубліковане з'явиться на лендінгу."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1.6fr 1fr auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <span className="wfp-doc-type-pill" data-t={p.type}>
                {TYPE_LABEL[p.type]}
              </span>
              <button
                type="button"
                onClick={() => setEditingId(p.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--wf-fg)',
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.titleUk}
                {p.featured ? ' ★' : ''}
              </button>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                /{p.slug}
              </span>
              <span
                className={`wfp-badge wfp-badge--${p.published ? 'success' : 'muted'}`}
                title={p.publishedAt ?? undefined}
              >
                {p.published ? 'опубліковано' : 'чернетка'}
              </span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={publish.isPending}
                  onClick={() =>
                    publish.mutate(
                      { id: p.id, published: !p.published },
                      {
                        onSuccess: () =>
                          toast.success(p.published ? 'Знято з публікації' : 'Опубліковано'),
                      }
                    )
                  }
                >
                  {p.published ? 'зняти' : 'опублікувати'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`Видалити «${p.titleUk}»?`)) return
                    del.mutate(p.id, { onSuccess: () => toast.success('Видалено') })
                  }}
                >
                  ✕
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {editingId && <EditorModal id={editingId} onClose={() => setEditingId(null)} />}
    </div>
  )
}

function EditorModal({ id, onClose }: { id: string; onClose: () => void }) {
  const isNew = id === 'new'
  const { data: post } = useCmsPost(isNew ? null : id)
  const create = useCreateCmsPost()
  const update = useUpdateCmsPost()
  const generate = useGenerateDraft()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [topic, setTopic] = useState('')

  useEffect(() => {
    if (post) {
      setForm({
        slug: post.slug,
        type: post.type,
        titleUk: post.titleUk,
        titleEn: post.titleEn,
        excerptUk: post.excerptUk,
        excerptEn: post.excerptEn,
        textUk: blocksToText(post.contentUk),
        textEn: blocksToText(post.contentEn),
        tags: post.tags.join(', '),
        featured: post.featured,
      })
    }
  }, [post])

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const applyDraft = (d: BlogDraft) =>
    set({
      slug: d.slug,
      titleUk: d.titleUk,
      titleEn: d.titleEn,
      excerptUk: d.excerptUk,
      excerptEn: d.excerptEn,
      textUk: blocksToText(d.contentUk),
      textEn: blocksToText(d.contentEn),
      tags: d.tags.join(', '),
    })

  const save = () => {
    const body = toInput(form)
    const onError = (err: unknown) =>
      toast.error(err instanceof ApiError ? err.message : 'Не вдалося зберегти')
    if (isNew) {
      create.mutate(body, {
        onSuccess: () => (toast.success('Чернетку створено'), onClose()),
        onError,
      })
    } else {
      update.mutate(
        { id, ...body },
        { onSuccess: () => (toast.success('Збережено'), onClose()), onError }
      )
    }
  }

  return (
    <Modal open title={isNew ? 'Новий пост' : 'Редагувати пост'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto', padding: 2 }}>
        {/* AI-чернетка */}
        <Card title="AI-чернетка" style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Тема, напр. «Як агенції вести облік годин»"
            />
            <Button
              variant="ghost"
              loading={generate.isPending}
              disabled={topic.trim().length < 5}
              onClick={() =>
                generate.mutate(
                  { topic: topic.trim(), type: form.type },
                  {
                    onSuccess: (d) => (applyDraft(d), toast.success('Чернетку згенеровано')),
                    onError: (err) =>
                      toast.error(err instanceof ApiError ? err.message : 'AI недоступний'),
                  }
                )
              }
            >
              ✦ Згенерувати
            </Button>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input
            label="Slug (латиниця-з-дефісами)"
            value={form.slug}
            onChange={(e) => set({ slug: e.target.value })}
          />
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            Тип
            <select
              value={form.type}
              onChange={(e) => set({ type: e.target.value as FormState['type'] })}
              style={{ padding: 8 }}
            >
              <option value="article">Стаття</option>
              <option value="case_study">Кейс</option>
            </select>
          </label>
          <Input
            label="Заголовок UK"
            value={form.titleUk}
            onChange={(e) => set({ titleUk: e.target.value })}
          />
          <Input
            label="Заголовок EN"
            value={form.titleEn}
            onChange={(e) => set({ titleEn: e.target.value })}
          />
          <Input
            label="Анонс UK"
            value={form.excerptUk}
            onChange={(e) => set({ excerptUk: e.target.value })}
          />
          <Input
            label="Анонс EN"
            value={form.excerptEn}
            onChange={(e) => set({ excerptEn: e.target.value })}
          />
        </div>

        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // формат: «## Секція» · «- пункт» · «&gt; цитата» · «! callout» · ```код``` · абзаци
          через порожній рядок
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          Контент UK
          <textarea
            value={form.textUk}
            onChange={(e) => set({ textUk: e.target.value })}
            rows={10}
            style={{ width: '100%', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          Контент EN
          <textarea
            value={form.textEn}
            onChange={(e) => set({ textEn: e.target.value })}
            rows={6}
            style={{ width: '100%', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}
        >
          <Input
            label="Теги (через кому)"
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
          />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set({ featured: e.target.checked })}
            />
            featured
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending || update.isPending}
            disabled={
              form.slug.trim().length < 3 ||
              form.titleUk.trim().length < 3 ||
              form.textUk.trim().length === 0
            }
            onClick={save}
          >
            {isNew ? 'Створити чернетку' : 'Зберегти'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── TESTIMONIALS (Фаза B): відгуки лендінга — список + зірки + publish/featured ──
function Stars({ n }: { n: number }) {
  return (
    <span style={{ color: 'var(--wf-accent)', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {'★'.repeat(n)}
      <span style={{ color: 'var(--wf-border-strong, var(--wf-border))' }}>
        {'★'.repeat(5 - n)}
      </span>
    </span>
  )
}

function TestimonialsSection() {
  const { data: items = [], isLoading } = useTestimonials()
  const update = useUpdateTestimonial()
  const del = useDeleteTestimonial()
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null)

  const published = items.filter((t) => t.published)
  const avg =
    published.length > 0
      ? (published.reduce((s, t) => s + t.rating, 0) / published.length).toFixed(1)
      : '—'

  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '10px 0 14px',
        }}
      >
        <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // {items.length} всього · {published.length} на лендінгу · сер. оцінка {avg}
        </span>
        <Button variant="primary" onClick={() => setEditing('new')}>
          + Відгук
        </Button>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 180 }} />
      ) : items.length === 0 ? (
        <EmptyState
          glyph="// ★"
          title="Відгуків ще немає"
          description="Додай перший відгук клієнта — опубліковане з'явиться на лендінгу."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {items.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 2fr auto auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid var(--wf-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setEditing(t)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--wf-fg)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 500 }}>
                  {t.authorName}
                  {t.featured ? ' ★' : ''}
                </div>
                <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                  {[t.authorRole, t.company].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--wf-fg-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={t.text}
              >
                {t.text}
              </span>
              <Stars n={t.rating} />
              <span className={`wfp-badge wfp-badge--${t.published ? 'success' : 'muted'}`}>
                {t.published ? 'на лендінгу' : 'чернетка'}
              </span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { id: t.id, published: !t.published },
                      {
                        onSuccess: () =>
                          toast.success(t.published ? 'Знято з лендінга' : 'Опубліковано'),
                      }
                    )
                  }
                >
                  {t.published ? 'зняти' : 'опублікувати'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`Видалити відгук «${t.authorName}»?`)) return
                    del.mutate(t.id, { onSuccess: () => toast.success('Видалено') })
                  }}
                >
                  ✕
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TestimonialModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TestimonialModal({ item, onClose }: { item: Testimonial | null; onClose: () => void }) {
  const create = useCreateTestimonial()
  const update = useUpdateTestimonial()
  const [authorName, setAuthorName] = useState(item?.authorName ?? '')
  const [authorRole, setAuthorRole] = useState(item?.authorRole ?? '')
  const [company, setCompany] = useState(item?.company ?? '')
  const [text, setText] = useState(item?.text ?? '')
  const [rating, setRating] = useState(item?.rating ?? 5)
  const [featured, setFeatured] = useState(item?.featured ?? false)

  const save = () => {
    const body: TestimonialInput = {
      authorName: authorName.trim(),
      authorRole: authorRole.trim() || null,
      company: company.trim() || null,
      text: text.trim(),
      rating,
      featured,
    }
    const onError = (err: unknown) =>
      toast.error(err instanceof ApiError ? err.message : 'Не вдалося зберегти')
    if (item) {
      update.mutate(
        { id: item.id, ...body },
        { onSuccess: () => (toast.success('Збережено'), onClose()), onError }
      )
    } else {
      create.mutate(body, {
        onSuccess: () => (toast.success('Відгук додано (чернетка)'), onClose()),
        onError,
      })
    }
  }

  return (
    <Modal open title={item ? 'Редагувати відгук' : 'Новий відгук'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Input
          label="Автор (ПІБ)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input
            label="Посада"
            value={authorRole}
            onChange={(e) => setAuthorRole(e.target.value)}
            placeholder="CEO"
          />
          <Input label="Компанія" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          Текст відгуку
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            style={{ width: '100%', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'inline-flex', gap: 3 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                style={{
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  fontSize: 20,
                  color:
                    n <= rating ? 'var(--wf-accent)' : 'var(--wf-border-strong, var(--wf-border))',
                }}
                aria-label={`Оцінка ${n}`}
              >
                ★
              </button>
            ))}
          </span>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            featured (перші на лендінгу)
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending || update.isPending}
            disabled={authorName.trim().length < 2 || text.trim().length < 10}
            onClick={save}
          >
            {item ? 'Зберегти' : 'Додати'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
