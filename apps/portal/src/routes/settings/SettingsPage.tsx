import { Fragment, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Locale } from '@workflo/i18n'
import { Button, Card, Input, Skeleton, StatusDot, useTheme, type ThemeMode } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useTelegramConnect, useTelegramDisconnect, useTelegramStatus } from '@/lib/telegram'
import {
  LOCKED_EMAIL,
  NOTIF_CATEGORIES,
  NOTIF_CHANNELS,
  prefKey,
  useNotificationPrefs,
  useSaveNotificationPrefs,
  type NotifCategory,
  type NotifChannel,
} from '@/lib/notificationPrefs'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'
import {
  useRequisites,
  useSaveRequisites,
  type Requisites,
  type RequisitesInput,
} from '@/lib/requisites'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Світла' },
  { id: 'dark', label: 'Темна' },
  { id: 'system', label: 'Системна' },
]
const LOCALES: { id: Locale; label: string }[] = [
  { id: 'uk', label: 'UA' },
  { id: 'en', label: 'EN' },
]

export function SettingsPage() {
  const { user, reload } = useAuth()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useI18n()
  const [name, setName] = useState(user?.profile.displayName ?? '')

  // Display-name save → confirm + refresh auth (sidebar/topbar reflect it).
  const profileMut = useMutation({
    mutationFn: (body: { displayName: string }) => api.patch('/profile', body),
    onSuccess: () => {
      toast.success('Збережено')
      void reload()
    },
  })

  // Appearance prefs → silent server-sync (localStorage already updated instantly).
  const prefMut = useMutation({
    mutationFn: (body: { theme?: ThemeMode; language?: Locale }) => api.patch('/profile', body),
  })

  const setThemePref = (t: ThemeMode) => {
    setTheme(t)
    prefMut.mutate({ theme: t })
  }
  const setLocalePref = (l: Locale) => {
    setLocale(l)
    prefMut.mutate({ language: l })
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Налаштування</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // {user?.profile.email}
      </div>

      <Card title="Профіль" style={{ marginBottom: 16 }}>
        <Input label="Імʼя та прізвище" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <Button
            variant="primary"
            loading={profileMut.isPending}
            disabled={name.trim().length < 2 || name.trim() === user?.profile.displayName}
            onClick={() => profileMut.mutate({ displayName: name.trim() })}
          >
            Зберегти
          </Button>
        </div>
      </Card>

      <Card title="Вигляд" style={{ marginBottom: 16 }}>
        <div className="wfp-side">
          <div className="wfp-side-row">
            <div className="wfp-side-k">тема</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="wfp-pill"
                  data-on={theme === t.id || undefined}
                  onClick={() => setThemePref(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="wfp-side-row">
            <div className="wfp-side-k">мова</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {LOCALES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="wfp-pill"
                  data-on={locale === l.id || undefined}
                  onClick={() => setLocalePref(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <RequisitesSection />

      <NotificationsSection />

      <TelegramSection />

      <PasswordSection />
    </div>
  )
}

const LEGAL_TYPES = [
  { value: '', label: '—' },
  { value: 'fop', label: 'ФОП' },
  { value: 'tov', label: 'ТОВ' },
  { value: 'individual', label: 'Фізособа' },
  { value: 'foreign', label: 'Іноземна' },
]

const reqSelectStyle = {
  width: '100%',
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 14,
} as const

function NotificationsSection() {
  const { data: prefs, isLoading } = useNotificationPrefs()
  const save = useSaveNotificationPrefs()
  const [matrix, setMatrix] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!prefs) return
    const m: Record<string, boolean> = {}
    for (const p of prefs) m[prefKey(p.category, p.channel)] = p.enabled
    setMatrix(m)
  }, [prefs])

  const isLocked = (cat: NotifCategory, ch: NotifChannel) =>
    ch === 'email' && LOCKED_EMAIL.includes(cat)
  const isOn = (cat: NotifCategory, ch: NotifChannel) =>
    isLocked(cat, ch) || matrix[prefKey(cat, ch)] === true
  const toggle = (cat: NotifCategory, ch: NotifChannel) => {
    if (isLocked(cat, ch)) return
    setMatrix((m) => ({ ...m, [prefKey(cat, ch)]: !m[prefKey(cat, ch)] }))
  }

  const onSave = () => {
    const preferences = NOTIF_CATEGORIES.flatMap((c) =>
      NOTIF_CHANNELS.map((ch) => ({
        category: c.key,
        channel: ch.key,
        enabled: isOn(c.key, ch.key),
      }))
    )
    save.mutate(preferences, {
      onSuccess: () => toast.success('Налаштування сповіщень збережено'),
      onError: () => toast.error('Не вдалося зберегти'),
    })
  }

  return (
    <Card title="Сповіщення" style={{ marginBottom: 16 }}>
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // які події в які канали приходять
      </div>
      {isLoading ? (
        <Skeleton style={{ height: 220 }} />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr repeat(3, 1fr)',
              gap: '10px 8px',
              alignItems: 'center',
            }}
          >
            <div />
            {NOTIF_CHANNELS.map((ch) => (
              <div
                key={ch.key}
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--wf-fg-muted)',
                }}
              >
                {ch.label}
              </div>
            ))}
            {NOTIF_CATEGORIES.map((c) => (
              <Fragment key={c.key}>
                <div style={{ fontSize: 14 }}>{c.label}</div>
                {NOTIF_CHANNELS.map((ch) => {
                  const locked = isLocked(c.key, ch.key)
                  return (
                    <div key={ch.key} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isOn(c.key, ch.key)}
                        disabled={locked}
                        onChange={() => toggle(c.key, ch.key)}
                        title={locked ? 'Критичні події — email завжди увімкнено' : undefined}
                        style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
                      />
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Button variant="primary" size="sm" loading={save.isPending} onClick={onSave}>
              Зберегти
            </Button>
            <span style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              Email для «Безпека» та «Рахунки й оплати» завжди увімкнено.
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

function TelegramSection() {
  const qc = useQueryClient()
  const { data: status, isLoading } = useTelegramStatus()
  const connect = useTelegramConnect()
  const disconnect = useTelegramDisconnect()

  const onConnect = () =>
    connect.mutate(undefined, {
      onSuccess: (r) => {
        window.open(r.deepLink, '_blank')
        toast.info('Відкрийте Telegram і натисніть «Start», потім поверніться сюди')
        setTimeout(() => void qc.invalidateQueries({ queryKey: ['telegram-status'] }), 8000)
      },
      onError: () => toast.error('Не вдалося створити посилання'),
    })

  return (
    <Card title="Telegram-сповіщення" style={{ marginBottom: 16 }}>
      {isLoading ? (
        <Skeleton style={{ height: 48 }} />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {status?.linked ? (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <StatusDot tone="success" />
                Підключено{status.linkedAt ? ` · ${formatDate(status.linkedAt)}` : ''}
              </span>
              <Button
                variant="secondary"
                size="sm"
                loading={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                Відвʼязати
              </Button>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--wf-fg-muted)', fontSize: 14 }}>
                Підключіть Telegram, щоб отримувати миттєві сповіщення про ваші замовлення.
              </span>
              <Button size="sm" loading={connect.isPending} onClick={onConnect}>
                Підключити Telegram
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function RequisitesSection() {
  const { data, isLoading } = useRequisites()
  return (
    <Card title="Реквізити компанії" style={{ marginBottom: 16 }}>
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // юр-дані для рахунків та актів від агенції
      </div>
      {isLoading ? (
        <Skeleton style={{ height: 220 }} />
      ) : (
        <RequisitesForm initial={data?.requisites ?? null} />
      )}
    </Card>
  )
}

function RequisitesForm({ initial }: { initial: Requisites | null }) {
  const save = useSaveRequisites()
  const [legalType, setLegalType] = useState(initial?.legalType ?? '')
  const [legalName, setLegalName] = useState(initial?.legalName ?? '')
  const [taxId, setTaxId] = useState(initial?.taxId ?? '')
  const [vatPayer, setVatPayer] = useState(initial?.vatPayer ?? false)
  const [vatId, setVatId] = useState(initial?.vatId ?? '')
  const [legalAddress, setLegalAddress] = useState(initial?.legalAddress ?? '')
  const [bankName, setBankName] = useState(initial?.bankName ?? '')
  const [iban, setIban] = useState(initial?.iban ?? '')
  const [signerName, setSignerName] = useState(initial?.signerName ?? '')
  const [signerTitle, setSignerTitle] = useState(initial?.signerTitle ?? '')
  const [documentEmail, setDocumentEmail] = useState(initial?.documentEmail ?? '')
  const [documentEmailCc, setDocumentEmailCc] = useState(initial?.documentEmailCc ?? '')

  const submit = () => {
    const body: RequisitesInput = {
      legalType: legalType || null,
      legalName: legalName.trim() || null,
      taxId: taxId.trim() || null,
      vatPayer,
      vatId: vatPayer ? vatId.trim() || null : null,
      legalAddress: legalAddress.trim() || null,
      bankName: bankName.trim() || null,
      iban: iban.trim() || null,
      signerName: signerName.trim() || null,
      signerTitle: signerTitle.trim() || null,
      documentEmail: documentEmail.trim() || null,
      documentEmailCc: documentEmailCc.trim() || null,
    }
    save.mutate(body, { onSuccess: () => toast.success('Реквізити збережено') })
  }

  const complete = initial?.legalIsComplete ?? false

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: complete ? 'var(--wf-success)' : 'var(--wf-warning)' }}
      >
        {complete
          ? '✓ готово до документів'
          : '// для документів потрібні: юр-назва, ІПН/ЄДРПОУ, IBAN, підписант'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ТИП
          </span>
          <select
            value={legalType}
            onChange={(e) => setLegalType(e.target.value)}
            style={reqSelectStyle}
          >
            {LEGAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <Input label="ІПН / ЄДРПОУ" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </div>
      <Input
        label="Юридична назва"
        value={legalName}
        onChange={(e) => setLegalName(e.target.value)}
      />
      <Input
        label="Юридична адреса"
        value={legalAddress}
        onChange={(e) => setLegalAddress(e.target.value)}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Input label="Банк" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
      </div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        Платник ПДВ
      </label>
      {vatPayer && (
        <Input label="ІПН ПДВ" value={vatId} onChange={(e) => setVatId(e.target.value)} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Підписант"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
        />
        <Input
          label="Посада підписанта"
          value={signerTitle}
          onChange={(e) => setSignerTitle(e.target.value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Email для документів"
          value={documentEmail}
          onChange={(e) => setDocumentEmail(e.target.value)}
        />
        <Input
          label="Email копія (CC)"
          value={documentEmailCc}
          onChange={(e) => setDocumentEmailCc(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
        <Button variant="primary" loading={save.isPending} onClick={submit}>
          Зберегти реквізити
        </Button>
        {save.isError && (
          <span style={{ fontSize: 12, color: 'var(--wf-destructive)' }}>
            Не вдалося зберегти — перевірте поля.
          </span>
        )}
      </div>
    </div>
  )
}

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.patch('/profile/password', body),
    meta: { suppressGlobalToast: true }, // surface the server error inline instead
    onSuccess: () => {
      toast.success('Пароль змінено. Інші сесії завершено.')
      setCurrent('')
      setNext('')
      setConfirm('')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося змінити пароль'),
  })

  const submit = () => {
    setError(null)
    if (next.length < 8 || next.length > 128) {
      setError('Пароль — від 8 до 128 символів')
      return
    }
    if (next !== confirm) {
      setError('Паролі не співпадають')
      return
    }
    mut.mutate({ currentPassword: current, newPassword: next })
  }

  return (
    <Card title="Безпека">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label="Поточний пароль"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <div>
          <Input
            label="Новий пароль"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <PasswordStrengthMeter value={next} />
        </div>
        <Input
          label="Підтвердження"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error ?? undefined}
        />
        <div>
          <Button
            variant="primary"
            loading={mut.isPending}
            disabled={!current || !next || !confirm}
            onClick={submit}
          >
            Змінити пароль
          </Button>
        </div>
      </div>
    </Card>
  )
}
