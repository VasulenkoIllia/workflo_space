import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Icon } from '@workflo/ui'
import {
  BillingType,
  ContactChannel,
  MAX_FILES_PER_ORDER,
  MAX_ORDER_FILE_BYTES,
  OrderCategory,
  OrderPriority,
  isAllowedFileMimeType,
} from '@workflo/types'
import {
  CONTACT_CHANNEL_LABEL,
  ORDER_CATEGORY_LABEL,
  preferredBillingLabel,
} from '@workflo/app-core'
import { uploadOrderFile, useCreateOrder } from '@/lib/orders'
import { formatBytes } from '@/lib/format'

// DSN-4: нове замовлення за design-v2 portal-order-new.jsx — 5 нумерованих секцій + бокова
// панель заявки. «Зберегти чернетку» свідомо НЕМА: чернетки порталу відхилено власником
// (02-orders «Прохід власника 11.06», пункт З). Файли вантажаться ПІСЛЯ створення.

const PRIORITY_CHIPS: { value: OrderPriority; label: string; dot: string }[] = [
  { value: OrderPriority.LOW, label: 'Low · не горить', dot: 'var(--wf-fg-subtle)' },
  { value: OrderPriority.MEDIUM, label: 'Normal', dot: 'var(--wf-accent)' },
  { value: OrderPriority.HIGH, label: 'High', dot: 'var(--wf-warning)' },
  { value: OrderPriority.URGENT, label: 'Urgent · 🔥', dot: 'var(--wf-destructive)' },
]

// null = «обговорити» (контракт: preferredBilling null)
const BILLING_CHIPS: { value: BillingType | null; icon: 'receipt' | 'coins' | 'alert' }[] = [
  { value: BillingType.FIXED, icon: 'receipt' },
  { value: BillingType.HOURLY, icon: 'coins' },
  { value: null, icon: 'alert' },
]

const CHANNEL_CHIPS: { value: ContactChannel; icon: 'inbox' | 'send' | 'bell' | 'globe' }[] = [
  { value: ContactChannel.SYSTEM, icon: 'inbox' },
  { value: ContactChannel.TELEGRAM, icon: 'send' },
  { value: ContactChannel.EMAIL, icon: 'bell' },
  { value: ContactChannel.PHONE, icon: 'globe' },
]

const TITLE_MIN = 10

const inputBox = {
  height: 38,
  padding: '0 12px',
  background: 'var(--wf-bg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 6,
  color: 'var(--wf-fg)',
  font: 'inherit',
  fontSize: 13,
} as const

/** «4 000» / «4000,50» → 4000.5; порожнє → null; сміття → NaN (валідація нижче). */
function parseBudget(raw: string): number | null {
  const s = raw.replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  return Number(s)
}

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function OrderCreatePage() {
  const navigate = useNavigate()
  const create = useCreateOrder()
  const fileInput = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<OrderCategory | ''>('')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState<OrderPriority>(OrderPriority.MEDIUM)
  const [billing, setBilling] = useState<BillingType | null>(BillingType.FIXED)
  const [dueDate, setDueDate] = useState('')
  const [flexible, setFlexible] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [channel, setChannel] = useState<ContactChannel>(ContactChannel.SYSTEM)
  const [uploading, setUploading] = useState(false)

  const titleTrim = title.trim()
  const titleInvalid = titleTrim.length < TITLE_MIN
  const budgetValue = parseBudget(budget)
  const budgetInvalid =
    budgetValue != null &&
    (!Number.isFinite(budgetValue) || budgetValue <= 0 || budgetValue > 99_999_999)
  const busy = create.isPending || uploading

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const next = [...files]
    const rejected: string[] = []
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES_PER_ORDER) {
        rejected.push(`${f.name} — ліміт ${MAX_FILES_PER_ORDER} файлів`)
      } else if (f.size > MAX_ORDER_FILE_BYTES) {
        rejected.push(`${f.name} — більше ${formatBytes(MAX_ORDER_FILE_BYTES)}`)
      } else if (!isAllowedFileMimeType(f.type || 'application/octet-stream')) {
        rejected.push(`${f.name} — тип файлу не дозволено`)
      } else if (!next.some((x) => x.name === f.name && x.size === f.size)) {
        next.push(f)
      }
    }
    setFiles(next)
    setFileError(rejected.length ? rejected.join(' · ') : null)
  }

  const submit = async () => {
    if (titleInvalid || budgetInvalid || busy) return
    let orderId: string
    try {
      const res = await create.mutateAsync({
        title: titleTrim,
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
        category: category || null,
        clientBudget: budgetValue,
        preferredBilling: billing,
        deadlineFlexible: dueDate ? flexible : false,
        preferredChannel: channel,
      })
      orderId = res.order.id
    } catch {
      return // помилку показує create.isError під кнопкою
    }
    if (files.length > 0) {
      setUploading(true)
      let failed = 0
      // послідовно — не душимо upload-ендпоінт паралельними multipart-ами
      for (const f of files) {
        try {
          await uploadOrderFile(orderId, f)
        } catch {
          failed += 1
        }
      }
      setUploading(false)
      if (failed > 0) {
        toast.warning(
          `${failed} з ${files.length} файлів не завантажились — додайте їх у табі «Файли»`
        )
      }
    }
    toast.success('Замовлення створено · очікуйте оцінку')
    navigate(`/orders/${orderId}`)
  }

  const prio = PRIORITY_CHIPS.find((p) => p.value === priority)

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Нове замовлення</h1>
          <div className="wfp-ph-sub">// розкажіть що потрібно — оцінку дамо за день</div>
        </div>
        <div className="wfp-ph-r">
          <Button variant="ghost" onClick={() => navigate('/orders')} disabled={busy}>
            Скасувати
          </Button>
        </div>
      </div>

      <div
        className="wfp-cols2"
        style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}
      >
        <div>
          <Section n={1} title="Що потрібно зробити?" aux="// обов'язково">
            <div className="wfp-field">
              <label htmlFor="no-title">Назва замовлення</label>
              <input
                id="no-title"
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Напр.: Інтеграція 1С ↔ Telegram-бот для водіїв"
              />
              <div
                className={`wfp-field-hint${titleInvalid && title.length > 0 ? ' wfp-field-hint--error' : ''}`}
              >
                1 речення · ≥{TITLE_MIN} символів · побачите ви та команда
              </div>
            </div>
            <div className="wfp-field" style={{ marginTop: 12 }}>
              <label htmlFor="no-desc">Опис · детально</label>
              <textarea
                id="no-desc"
                className="wfp-no-textarea"
                value={description}
                maxLength={10_000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Контекст, обсяг, обмеження, посилання…"
                style={{ minHeight: 160 }}
              />
              <div className="wfp-field-hint">розкажіть про контекст, обсяг, обмеження</div>
            </div>
          </Section>

          <Section n={2} title="Деталі" aux="// опційно · допомагає швидше оцінити">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              <div className="wfp-field">
                <label htmlFor="no-cat">Категорія</label>
                <select
                  id="no-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as OrderCategory | '')}
                  style={inputBox}
                >
                  <option value="">Виберіть категорію…</option>
                  {Object.values(OrderCategory).map((c) => (
                    <option key={c} value={c}>
                      {ORDER_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="wfp-field">
                <label htmlFor="no-budget">Орієнтовний бюджет</label>
                <div
                  style={{
                    ...inputBox,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    borderColor: budgetInvalid ? 'var(--wf-destructive)' : 'var(--wf-border)',
                  }}
                >
                  <span style={{ color: 'var(--wf-fg-muted)' }}>$</span>
                  <input
                    id="no-budget"
                    inputMode="decimal"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="—"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 'auto',
                      border: 0,
                      background: 'transparent',
                      boxShadow: 'none',
                      padding: 0,
                      color: 'var(--wf-fg)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                  <span style={{ color: 'var(--wf-fg-muted)', fontSize: 11 }}>
                    ± команда уточнить
                  </span>
                </div>
                {budgetInvalid && (
                  <div className="wfp-field-hint wfp-field-hint--error">вкажіть суму більше 0</div>
                )}
              </div>
            </div>
            <div className="wfp-field" style={{ marginTop: 12 }}>
              <label>Пріоритет</label>
              <div className="wfp-chip-group" role="radiogroup" aria-label="Пріоритет">
                {PRIORITY_CHIPS.map((p) => (
                  <Chip
                    key={p.value}
                    on={priority === p.value}
                    onClick={() => setPriority(p.value)}
                  >
                    <span className="wfp-chip-dot" style={{ background: p.dot }} />
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="wfp-field" style={{ marginTop: 12 }}>
              <label>Тип білінгу</label>
              <div className="wfp-chip-group" role="radiogroup" aria-label="Тип білінгу">
                {BILLING_CHIPS.map((b) => (
                  <Chip
                    key={b.value ?? 'discuss'}
                    on={billing === b.value}
                    onClick={() => setBilling(b.value)}
                  >
                    <Icon name={b.icon} size={13} />
                    {preferredBillingLabel(b.value)}
                  </Chip>
                ))}
              </div>
            </div>
          </Section>

          <Section n={3} title="Дедлайн" aux="// коли вам це треба">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                alignItems: 'end',
              }}
            >
              <div className="wfp-field">
                <label htmlFor="no-due">Бажана дата завершення</label>
                <input
                  id="no-due"
                  type="date"
                  min={todayIso()}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <label
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  height: 38,
                  fontSize: 12.5,
                  color: dueDate ? 'var(--wf-fg-secondary)' : 'var(--wf-fg-subtle)',
                  cursor: dueDate ? 'pointer' : 'default',
                }}
              >
                <input
                  type="checkbox"
                  checked={dueDate !== '' && flexible}
                  disabled={dueDate === ''}
                  onChange={(e) => setFlexible(e.target.checked)}
                  style={{ accentColor: 'var(--wf-accent-bg)' }}
                />
                <span>Гнучкий дедлайн · можемо посунути</span>
              </label>
            </div>
          </Section>

          <Section n={4} title="Файли" aux="// макети, брифи, приклади">
            <button
              type="button"
              className="wfp-upload"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                addFiles(e.dataTransfer.files)
              }}
              disabled={busy}
              style={{
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                ...(dragOver ? { borderColor: 'var(--wf-accent)' } : {}),
              }}
            >
              <span className="wfp-upload-glyph">
                <Icon name="download" size={20} />
              </span>
              <span>
                <span className="wfp-upload-t" style={{ display: 'block' }}>
                  Перетягніть файли сюди або{' '}
                  <span
                    style={{
                      color: 'var(--wf-accent)',
                      textDecoration: 'underline dashed',
                      textUnderlineOffset: 3,
                    }}
                  >
                    оберіть з диску
                  </span>
                </span>
                <span className="wfp-upload-sub" style={{ display: 'block' }}>
                  PDF, DOC, XLS, PNG, ZIP · до {formatBytes(MAX_ORDER_FILE_BYTES)} · завантажаться
                  після створення
                </span>
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            {fileError && (
              <div className="wfp-field-hint wfp-field-hint--error" style={{ marginTop: 8 }}>
                {fileError}
              </div>
            )}
            {files.map((f) => (
              <div key={`${f.name}-${f.size}`} className="wfp-file-row" style={{ marginTop: 10 }}>
                <div className="wfp-file-icon" style={{ color: 'var(--wf-fg-muted)' }}>
                  {(f.name.split('.').pop() ?? 'file').slice(0, 4).toUpperCase()}
                </div>
                <div className="wfp-file-meta">
                  <div className="wfp-file-name">{f.name}</div>
                  <div className="wfp-file-sub">
                    <span>{formatBytes(f.size)}</span>
                    <span>·</span>
                    <span>ви</span>
                  </div>
                </div>
                <div className="wfp-file-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}
                  >
                    Прибрати
                  </Button>
                </div>
              </div>
            ))}
          </Section>

          <Section n={5} title="Як зв'язуватися?" aux="// канал по замовчуванню">
            <div className="wfp-chip-group" role="radiogroup" aria-label="Канал звʼязку">
              {CHANNEL_CHIPS.map((c) => (
                <Chip key={c.value} on={channel === c.value} onClick={() => setChannel(c.value)}>
                  <Icon name={c.icon} size={13} />
                  {CONTACT_CHANNEL_LABEL[c.value]}
                </Chip>
              ))}
            </div>
            <div className="wfp-field-hint" style={{ marginTop: 10 }}>
              «У системі» = всі чати тут, копія в email. Сповіщення налаштовуються в
              «Налаштуваннях».
            </div>
          </Section>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              padding: '16px 0',
              borderTop: '1px dashed var(--wf-border)',
              marginTop: 12,
            }}
          >
            <div className="wfp-mono" style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}>
              // після створення команда відповість протягом доби з оцінкою
            </div>
            <Button
              variant="primary"
              loading={busy}
              disabled={titleInvalid || budgetInvalid}
              leftIcon={<Icon name="send" size={13} />}
              onClick={() => void submit()}
            >
              {uploading ? 'Завантажуємо файли…' : 'Створити замовлення'}
            </Button>
          </div>
          {create.isError && (
            <div className="wfp-field-hint wfp-field-hint--error">
              {create.error instanceof Error
                ? create.error.message
                : 'Не вдалося створити замовлення — спробуйте ще раз.'}
            </div>
          )}
        </div>

        {/* stretch — щоб sticky-панель мала висоту колонки й їхала за скролом форми */}
        <aside style={{ alignSelf: 'stretch' }}>
          <div className="wfp-no-side">
            <div className="wfp-no-side-h">
              <Icon name="check" size={14} style={{ color: 'var(--wf-success)' }} />
              Ваша заявка
              <span className="wfp-no-side-h-aux">попередній перегляд</span>
            </div>
            <SideRow k="назва" strong empty={titleTrim === ''}>
              {titleTrim || 'ще не вказано…'}
            </SideRow>
            <SideRow k="категорія" empty={!category}>
              {category ? ORDER_CATEGORY_LABEL[category] : 'не обрано'}
            </SideRow>
            <SideRow k="пріоритет">
              <span className="wfp-mono" style={{ color: prio?.dot }}>
                {priority}
              </span>
            </SideRow>
            <SideRow k="білінг">{preferredBillingLabel(billing)}</SideRow>
            <SideRow k="бюджет ~" empty={budgetValue == null || budgetInvalid}>
              {budgetValue != null && !budgetInvalid ? (
                <span className="wfp-mono">${budgetValue.toLocaleString('uk-UA')}</span>
              ) : (
                'не вказано'
              )}
            </SideRow>
            <SideRow k="дедлайн" empty={!dueDate}>
              {dueDate ? (
                <span className="wfp-mono">
                  {dueDate.split('-').reverse().join('.')}
                  {flexible ? ' · гнучкий' : ''}
                </span>
              ) : (
                'без дедлайну'
              )}
            </SideRow>
            <SideRow k="файли" empty={files.length === 0}>
              {files.length === 0
                ? 'немає'
                : `${files.length} · ${files.map((f) => f.name).join(', ')}`}
            </SideRow>
            <SideRow k="канал">
              {CONTACT_CHANNEL_LABEL[channel]}
              {channel === ContactChannel.SYSTEM ? ' + email копія' : ''}
            </SideRow>

            <div className="wfp-no-side-flow">
              <div style={{ color: 'var(--wf-fg)', fontWeight: 600, marginBottom: 6 }}>
                // що далі?
              </div>
              <div>1. ви натиснете «створити»</div>
              <div>2. команда отримає сповіщення</div>
              <div>3. протягом доби — оцінка від нас</div>
              <div>4. ви підтверджуєте — старт</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Section({
  n,
  title,
  aux,
  children,
}: {
  n: number
  title: string
  aux: string
  children: ReactNode
}) {
  return (
    <section className="wfp-no-section">
      <div className="wfp-no-section-h">
        <h2 className="wfp-no-section-h-t" data-n={n} style={{ margin: 0 }}>
          {title}
        </h2>
        <div className="wfp-no-section-h-aux">{aux}</div>
      </div>
      {children}
    </section>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className="wfp-chip"
      data-on={on || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SideRow({
  k,
  strong,
  empty,
  children,
}: {
  k: string
  strong?: boolean
  empty?: boolean
  children: ReactNode
}) {
  return (
    <div className="wfp-no-side-row">
      <div className="wfp-no-side-k">{k}</div>
      <div
        className={`wfp-no-side-v${empty ? ' wfp-no-side-v--empty' : ''}`}
        style={strong && !empty ? { fontWeight: 500 } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
