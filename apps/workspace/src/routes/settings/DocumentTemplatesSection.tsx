import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, Input, Skeleton } from '@workflo/ui'
import { API_URL, api, getAccessToken } from '@/lib/api'
import { Select } from '@/components/Select'

/**
 * 06-А (owner-only): шаблони документів з {{змінними}} + PDF-брендинг.
 * Договір — редагований список секцій (заголовок + абзаци через порожній рядок);
 * решта типів — примітка (+ призначення платежу для рахунків). Нема шаблону =
 * системний текст. Брендинг: лого (PNG/JPEG) + акцентний hex — на всіх PDF.
 */

interface TplSection {
  h: string
  p: string[]
}
interface TplRow {
  type: string
  body: { sections?: TplSection[]; note?: string; purpose?: string }
  updatedAt: string
}
interface TplData {
  templates: TplRow[]
  variables: { key: string; label: string }[]
  contractDefault: TplSection[]
}

const TYPE_OPTIONS = [
  { value: 'contract', label: 'Договір' },
  { value: 'invoice', label: 'Рахунок' },
  { value: 'advance_invoice', label: 'Аванс-рахунок' },
  { value: 'completion_act', label: 'Акт виконаних робіт' },
  { value: 'specification', label: 'Специфікація' },
  { value: 'reconciliation_act', label: 'Акт звірки' },
]

const secToText = (s: TplSection): string => s.p.join('\n\n')
const textToParas = (t: string): string[] =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)

const areaStyle = {
  width: '100%',
  minHeight: 90,
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'vertical' as const,
}

export function DocumentTemplatesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['doc-templates'],
    queryFn: () => api.get<TplData>('/workspace/agency/document-templates'),
  })
  const [type, setType] = useState('contract')
  // Редактор тримає СИРИЙ текст секції (абзаци = порожні рядки) і сплітить лише
  // при збереженні — інакше textarea зʼїдає порожній рядок під час набору.
  const [sections, setSections] = useState<{ h: string; text: string }[]>([])
  const [note, setNote] = useState('')
  const [purpose, setPurpose] = useState('')
  const [dirty, setDirty] = useState(false)

  const current = data?.templates.find((t) => t.type === type)

  // Перемикання типу / прихід даних → заповнити редактор поточним override
  useEffect(() => {
    setDirty(false)
    if (type === 'contract') {
      setSections((current?.body.sections ?? []).map((x) => ({ h: x.h, text: secToText(x) })))
    } else {
      setNote(current?.body.note ?? '')
      setPurpose(current?.body.purpose ?? '')
    }
  }, [type, current])

  const save = useMutation({
    mutationFn: () =>
      api.put(
        `/workspace/agency/document-templates/${type}`,
        type === 'contract'
          ? { sections: sections.map((x) => ({ h: x.h, p: textToParas(x.text) })) }
          : {
              ...(note.trim() ? { note: note.trim() } : {}),
              ...(purpose.trim() && (type === 'invoice' || type === 'advance_invoice')
                ? { purpose: purpose.trim() }
                : {}),
            }
      ),
    onSuccess: () => {
      toast.success('Шаблон збережено')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['doc-templates'] })
    },
    onError: () => toast.error('Не вдалося зберегти шаблон'),
  })
  const reset = useMutation({
    mutationFn: () => api.delete(`/workspace/agency/document-templates/${type}`),
    onSuccess: () => {
      toast.success('Повернуто системний шаблон')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['doc-templates'] })
    },
  })

  if (isLoading) return <Skeleton style={{ height: 160 }} />
  if (!data) return null

  const isContract = type === 'contract'
  const canSave = isContract
    ? sections.length > 0 && sections.every((s) => s.h.trim() && textToParas(s.text).length > 0)
    : note.trim().length > 0 || purpose.trim().length > 0

  return (
    <Card title="Шаблони документів">
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // редагований текст поверх системних PDF. Змінні:{' '}
        {data.variables.map((v) => `{{${v.key}}}`).join(' · ')}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ minWidth: 220 }}>
          <Select label="Тип документа" value={type} onChange={setType} options={TYPE_OPTIONS} />
        </div>
        <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          {current ? 'кастомний шаблон' : 'системний текст (без override)'}
        </span>
      </div>

      {isContract ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {sections.length === 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
                Використовується системний текст договору.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSections(data.contractDefault.map((x) => ({ h: x.h, text: secToText(x) })))
                  setDirty(true)
                }}
              >
                Заповнити типовим
              </Button>
            </div>
          )}
          {sections.map((s, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label={`Секція ${i + 1} · заголовок`}
                    value={s.h}
                    onChange={(e) => {
                      const next = [...sections]
                      next[i] = { ...s, h: e.target.value }
                      setSections(next)
                      setDirty(true)
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSections(sections.filter((_, j) => j !== i))
                    setDirty(true)
                  }}
                >
                  ✕
                </Button>
              </div>
              <textarea
                style={areaStyle}
                value={s.text}
                onChange={(e) => {
                  const next = [...sections]
                  next[i] = { ...s, text: e.target.value }
                  setSections(next)
                  setDirty(true)
                }}
                placeholder="Текст секції; абзаци розділяйте порожнім рядком"
              />
            </div>
          ))}
          {sections.length > 0 && (
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSections([...sections, { h: `${sections.length + 1}. Нова секція`, text: '' }])
                  setDirty(true)
                }}
              >
                + Додати секцію
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ПРИМІТКА НА PDF (порожньо = без примітки)
            </span>
            <textarea
              style={areaStyle}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setDirty(true)
              }}
              placeholder="Напр.: Оплата за {{order}} згідно {{contract}}."
            />
          </label>
          {(type === 'invoice' || type === 'advance_invoice') && (
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                ПРИЗНАЧЕННЯ ПЛАТЕЖУ (порожньо = системне)
              </span>
              <textarea
                style={{ ...areaStyle, minHeight: 60 }}
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value)
                  setDirty(true)
                }}
                placeholder="Оплата за рахунком № {{number}} від {{date}} за {{order}}"
              />
            </label>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
          disabled={!dirty || !canSave}
          onClick={() => save.mutate()}
        >
          Зберегти шаблон
        </Button>
        {current && (
          <Button
            variant="ghost"
            size="sm"
            loading={reset.isPending}
            onClick={() => reset.mutate()}
          >
            Скинути до системного
          </Button>
        )}
      </div>
    </Card>
  )
}

export function PdfBrandingSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['pdf-branding'],
    queryFn: () =>
      api.get<{ hasLogo: boolean; accentColor: string | null }>('/workspace/agency/pdf-branding'),
  })
  const [accent, setAccent] = useState('#A3D90D')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (data?.accentColor) setAccent(data.accentColor)
    if (data?.hasLogo) {
      const token = getAccessToken()
      void fetch(`${API_URL}/workspace/agency/pdf-branding/logo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => setLogoPreview(b ? URL.createObjectURL(b) : null))
    } else {
      setLogoPreview(null)
    }
  }, [data])

  const saveAccent = useMutation({
    mutationFn: (accentColor: string | null) =>
      api.put('/workspace/agency/pdf-branding', { accentColor }),
    onSuccess: () => {
      toast.success('Брендинг збережено')
      void qc.invalidateQueries({ queryKey: ['pdf-branding'] })
    },
  })
  const removeLogo = useMutation({
    mutationFn: () => api.put('/workspace/agency/pdf-branding', { removeLogo: true }),
    onSuccess: () => {
      toast.success('Лого прибрано')
      void qc.invalidateQueries({ queryKey: ['pdf-branding'] })
    },
  })

  const uploadLogo = async (file: File) => {
    const token = getAccessToken()
    const fd = new FormData()
    fd.append('accentColor', accent)
    fd.append('file', file)
    const res = await fetch(`${API_URL}/workspace/agency/pdf-branding`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: fd,
    })
    if (!res.ok) {
      toast.error('Не вдалося завантажити лого')
      return
    }
    toast.success('Лого оновлено')
    void qc.invalidateQueries({ queryKey: ['pdf-branding'] })
  }

  if (isLoading) return <Skeleton style={{ height: 100 }} />
  if (!data) return null

  return (
    <Card title="PDF-брендинг">
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // лого в шапці та акцентний колір на всіх PDF-документах агенції
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ЛОГО (PNG/JPEG, до 512 КБ)
          </span>
          {logoPreview ? (
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
              <img
                src={logoPreview}
                alt="Лого"
                style={{
                  maxHeight: 42,
                  maxWidth: 200,
                  background: '#fff',
                  padding: 4,
                  borderRadius: 6,
                }}
              />
              <button
                type="button"
                className="wfp-link"
                style={{ fontSize: 12 }}
                onClick={() => removeLogo.mutate()}
              >
                прибрати
              </button>
            </span>
          ) : (
            <input
              type="file"
              accept="image/png,image/jpeg"
              style={{ fontSize: 13 }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadLogo(f)
              }}
            />
          )}
        </div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            АКЦЕНТНИЙ КОЛІР
          </span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              style={{ width: 42, height: 30, border: 'none', background: 'none', padding: 0 }}
            />
            <span className="wfp-mono" style={{ fontSize: 12 }}>
              {accent}
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={saveAccent.isPending}
              onClick={() => saveAccent.mutate(accent)}
            >
              Зберегти
            </Button>
          </span>
        </label>
      </div>
    </Card>
  )
}

/** 08-EMAIL (owner-only): override теми/вступу бізнес-листів, окремо uk/en.
 * Порожні поля локалі = системний текст. Auth-листи не редагуються свідомо. */
interface MailTplRow {
  event: string
  locale: string
  subject: string | null
  intro: string | null
}
interface MailTplData {
  events: { event: string; label: string; vars: string[] }[]
  templates: MailTplRow[]
}

export function EmailTemplatesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get<MailTplData>('/workspace/agency/email-templates'),
  })
  const [event, setEvent] = useState('billing.invoice_sent')
  const [fields, setFields] = useState({ ukSubject: '', ukIntro: '', enSubject: '', enIntro: '' })
  const [dirty, setDirty] = useState(false)

  const rowsFor = (ev: string) => data?.templates.filter((t) => t.event === ev) ?? []
  const hasOverride = rowsFor(event).length > 0

  useEffect(() => {
    const uk = rowsFor(event).find((t) => t.locale === 'uk')
    const en = rowsFor(event).find((t) => t.locale === 'en')
    setFields({
      ukSubject: uk?.subject ?? '',
      ukIntro: uk?.intro ?? '',
      enSubject: en?.subject ?? '',
      enIntro: en?.intro ?? '',
    })
    setDirty(false)
  }, [event, data])

  const save = useMutation({
    mutationFn: () =>
      api.put(`/workspace/agency/email-templates/${event}`, {
        uk: { subject: fields.ukSubject, intro: fields.ukIntro },
        en: { subject: fields.enSubject, intro: fields.enIntro },
      }),
    onSuccess: () => {
      toast.success('Шаблон листа збережено')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['email-templates'] })
    },
    onError: () => toast.error('Не вдалося зберегти'),
  })
  const reset = useMutation({
    mutationFn: () => api.delete(`/workspace/agency/email-templates/${event}`),
    onSuccess: () => {
      toast.success('Повернуто системний текст')
      void qc.invalidateQueries({ queryKey: ['email-templates'] })
    },
  })

  if (isLoading) return <Skeleton style={{ height: 140 }} />
  if (!data) return null

  const meta = data.events.find((e) => e.event === event)
  const upd =
    (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((f) => ({ ...f, [k]: e.target.value }))
      setDirty(true)
    }

  return (
    <Card title="Email-шаблони">
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // тема + вступний абзац поверх системного листа. Auth-листи (пароль/вхід) — не редагуються.
        Порожньо = системний текст.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <div style={{ minWidth: 260 }}>
          <Select
            label="Лист"
            value={event}
            onChange={setEvent}
            options={data.events.map((e) => ({ value: e.event, label: e.label }))}
          />
        </div>
        <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          {hasOverride ? 'кастомний' : 'системний'}
        </span>
      </div>
      {meta && (
        <div
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
        >
          // змінні: {meta.vars.map((v) => `{{${v}}}`).join(' · ')}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {(
          [
            { code: 'uk', label: 'Українська', s: 'ukSubject', i: 'ukIntro' },
            { code: 'en', label: 'English', s: 'enSubject', i: 'enIntro' },
          ] as const
        ).map((loc) => (
          <div
            key={loc.code}
            style={{
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: 12,
              display: 'grid',
              gap: 8,
            }}
          >
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              {loc.label.toUpperCase()}
            </span>
            <Input
              label="Тема (порожньо = системна)"
              value={fields[loc.s]}
              onChange={upd(loc.s)}
              placeholder="Напр.: Рахунок {{invoiceNumber}} від workflo"
            />
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                ВСТУПНИЙ ТЕКСТ (порожньо = системний)
              </span>
              <textarea
                style={{ ...areaStyle, minHeight: 60 }}
                value={fields[loc.i]}
                onChange={upd(loc.i)}
                placeholder="Перший абзац листа — з {{змінними}} події"
              />
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
          disabled={!dirty}
          onClick={() => save.mutate()}
        >
          Зберегти
        </Button>
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            loading={reset.isPending}
            onClick={() => reset.mutate()}
          >
            Скинути до системного
          </Button>
        )}
      </div>
    </Card>
  )
}
