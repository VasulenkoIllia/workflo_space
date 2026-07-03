import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Locale } from '@workflo/i18n'
import { Button, Card, Icon, Input, Skeleton, useTheme, type ThemeMode } from '@workflo/ui'
import { api, ApiError } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  useTwoFactorDisable,
  useTwoFactorEnable,
  useTwoFactorSetup,
  useTwoFactorStatus,
} from '@/lib/twoFactor'
import {
  describeUserAgent,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from '@/lib/sessions'
import { startGoogleLink, useOauthAccounts, useOauthProviders, useUnlinkOauth } from '@/lib/oauth'
import { useSearchParams } from 'react-router-dom'
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

      <TwoFactorSection />

      <LinkedAccountsSection app="portal" />

      <SessionsSection />
    </div>
  )
}

/**
 * Соц-входи (S9 §E): привʼязка/відвʼязка Google. Відвʼязка вимагає пароль —
 * гарантія, що лишається ≥1 робочий спосіб входу. Картка ховається, коли
 * OAuth не налаштовано і нічого не привʼязано.
 */
function LinkedAccountsSection({ app }: { app: 'portal' | 'workspace' }) {
  const providers = useOauthProviders()
  const { data, isLoading } = useOauthAccounts()
  const unlink = useUnlinkOauth()
  const [pwd, setPwd] = useState('')
  const [params, setParams] = useSearchParams()

  // OAuth callback landings on /settings: ?oauthLinked=1 / ?oauthError=taken
  useEffect(() => {
    const linked = params.get('oauthLinked')
    const err = params.get('oauthError')
    if (!linked && !err) return
    if (linked) toast.success('Google привʼязано до акаунту')
    if (err === 'taken') toast.error('Цей Google-акаунт уже привʼязано до іншого профілю')
    setParams({}, { replace: true })
  }, [params, setParams])

  const google = data?.accounts.find((a) => a.provider === 'google')
  if (!providers.data?.google && !google) return null

  return (
    <Card title="Безпека · способи входу" style={{ marginBottom: 16 }}>
      {isLoading ? (
        <Skeleton style={{ height: 60 }} />
      ) : google ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <Icon name="globe" size={16} />
            <span style={{ fontWeight: 600 }}>Google</span>
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              {google.email} · з {formatDate(google.createdAt)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 260 }}>
              <Input
                label="Пароль акаунта (щоб відвʼязати)"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              loading={unlink.isPending}
              disabled={pwd.trim().length === 0}
              onClick={() =>
                unlink.mutate(
                  { provider: 'google', password: pwd.trim() },
                  {
                    onSuccess: () => {
                      setPwd('')
                      toast.success('Google відвʼязано')
                    },
                    onError: () => toast.error('Невірний пароль'),
                  }
                )
              }
            >
              Відвʼязати Google
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
            Привʼяжіть Google, щоб входити одним кліком без пароля.
          </div>
          <div>
            <Button variant="ghost" onClick={() => void startGoogleLink(app)}>
              Привʼязати Google
            </Button>
          </div>
        </div>
      )}
    </Card>
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

/** Pill switch (design: workspace-notify.jsx NfToggle). Locked → non-interactive, dimmed. */
function NfToggle({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      disabled={locked}
      title={locked ? 'Критичні події — email завжди увімкнено' : undefined}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        border: 0,
        cursor: locked ? 'not-allowed' : 'pointer',
        padding: 2,
        background: on ? 'var(--wf-accent)' : 'var(--wf-border-strong)',
        display: 'inline-flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background .12s',
        opacity: locked ? 0.6 : 1,
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }}
      />
    </button>
  )
}

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
          <table className="wfp-table">
            <thead>
              <tr>
                <th>Категорія</th>
                {NOTIF_CHANNELS.map((ch) => (
                  <th key={ch.key} style={{ textAlign: 'center' }}>
                    {ch.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIF_CATEGORIES.map((c) => (
                <tr key={c.key}>
                  <td style={{ fontWeight: 500 }}>{c.label}</td>
                  {NOTIF_CHANNELS.map((ch) => (
                    <td key={ch.key} style={{ textAlign: 'center' }}>
                      <NfToggle
                        on={isOn(c.key, ch.key)}
                        locked={isLocked(c.key, ch.key)}
                        onClick={() => toggle(c.key, ch.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
                <span className="wfp-verified-pill">
                  <Icon name="check" size={11} /> підключено
                </span>
                {status.linkedAt && (
                  <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                    · {formatDate(status.linkedAt)}
                  </span>
                )}
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
    <Card title="Безпека · пароль" style={{ marginBottom: 16 }}>
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

/**
 * Двофакторна автентифікація (S9-01, portal). Той самий бекенд, що workspace:
 * setup → QR (лінива qrcode) + ключ → перший код → одноразові резервні коди.
 * Disable: пароль акаунта.
 */
function TwoFactorSection() {
  const { data, isLoading } = useTwoFactorStatus()
  const setup = useTwoFactorSetup()
  const enable = useTwoFactorEnable()
  const disable = useTwoFactorDisable()
  const [step, setStep] = useState<'idle' | 'setup'>('idle')
  const [otpauth, setOtpauth] = useState('')
  const [secret, setSecret] = useState('')
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disablePwd, setDisablePwd] = useState('')

  const startSetup = async () => {
    try {
      const r = await setup.mutateAsync()
      setSecret(r.secret)
      setOtpauth(r.otpauthUrl)
      setStep('setup')
      const QR = (await import('qrcode')).default
      setQr(await QR.toDataURL(r.otpauthUrl, { margin: 1, width: 200 }))
    } catch {
      toast.error('Не вдалося почати налаштування 2FA')
    }
  }

  const confirmEnable = () => {
    enable.mutate(code.trim(), {
      onSuccess: (r) => {
        setBackupCodes(r.backupCodes)
        setStep('idle')
        setCode('')
        toast.success('Двофакторну автентифікацію увімкнено')
      },
      onError: () => toast.error('Невірний код — спробуйте ще раз'),
    })
  }

  const doDisable = () => {
    disable.mutate(
      { password: disablePwd.trim() || undefined },
      {
        onSuccess: () => {
          setDisablePwd('')
          setBackupCodes(null)
          toast.success('2FA вимкнено')
        },
        onError: () => toast.error('Потрібен код 2FA або пароль акаунта'),
      }
    )
  }

  return (
    <Card title="Безпека · двофакторна автентифікація" style={{ marginBottom: 16 }}>
      {isLoading ? (
        <Skeleton style={{ height: 80 }} />
      ) : data?.enabled ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={16} />
            <span style={{ fontWeight: 600 }}>2FA увімкнено</span>
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              · резервних кодів: {data.backupCodesRemaining}
            </span>
          </div>
          {backupCodes && <BackupCodesBox codes={backupCodes} />}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 260 }}>
              <Input
                label="Пароль акаунта (щоб вимкнути)"
                type="password"
                value={disablePwd}
                onChange={(e) => setDisablePwd(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              loading={disable.isPending}
              disabled={disablePwd.trim().length === 0}
              onClick={doDisable}
            >
              Вимкнути 2FA
            </Button>
          </div>
        </div>
      ) : step === 'setup' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            // 1. Відскануйте QR у Google Authenticator / 1Password / Authy
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {qr ? (
              <img
                src={qr}
                alt="QR для 2FA"
                width={180}
                height={180}
                style={{ border: '1px solid var(--wf-border)', borderRadius: 8 }}
              />
            ) : (
              <Skeleton style={{ width: 180, height: 180 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                або введіть ключ вручну:
              </div>
              <code
                style={{
                  display: 'inline-block',
                  wordBreak: 'break-all',
                  fontSize: 13,
                  padding: '4px 8px',
                  background: 'var(--wf-surface)',
                  border: '1px solid var(--wf-border)',
                  borderRadius: 6,
                  marginTop: 4,
                }}
              >
                {secret}
              </code>
              <a
                href={otpauth}
                className="wfp-link wfp-mono"
                style={{ display: 'block', fontSize: 11, marginTop: 6 }}
              >
                відкрити в застосунку →
              </a>
            </div>
          </div>
          <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            // 2. Введіть 6-значний код із застосунку
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ maxWidth: 160 }}>
              <Input
                label="Код"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              loading={enable.isPending}
              disabled={code.trim().length < 6}
              onClick={confirmEnable}
            >
              Увімкнути
            </Button>
            <Button variant="ghost" onClick={() => setStep('idle')}>
              Скасувати
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {backupCodes && <BackupCodesBox codes={backupCodes} />}
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
            Захистіть акаунт кодом із застосунку-автентифікатора на додачу до пароля.
          </div>
          <div>
            <Button variant="primary" loading={setup.isPending} onClick={() => void startSetup()}>
              Увімкнути 2FA
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

/** Одноразовий показ резервних кодів (копіювати/зберегти). */
function BackupCodesBox({ codes }: { codes: string[] }) {
  return (
    <div
      style={{
        border: '1px solid var(--wf-accent)',
        borderRadius: 8,
        padding: 12,
        background: 'color-mix(in oklab, var(--wf-accent) 6%, transparent)',
      }}
    >
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
      >
        // резервні коди — збережіть зараз, більше не покажемо. Кожен діє один раз.
      </div>
      <div
        className="wfp-mono"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 13 }}
      >
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <button
        type="button"
        className="wfp-link wfp-mono"
        style={{ fontSize: 11, marginTop: 8 }}
        onClick={() => {
          void navigator.clipboard?.writeText(codes.join('\n'))
          toast.success('Коди скопійовано')
        }}
      >
        копіювати всі
      </button>
    </div>
  )
}

/**
 * Активні сесії (S9-02, portal). Одна картка на живий пристрій; revoke гасить
 * refresh-токен — пристрій вилетить на найближчому оновленні сесії (до 15 хв).
 */
function SessionsSection() {
  const { data, isLoading } = useSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const sessions = data?.sessions ?? []
  const others = sessions.filter((s) => !s.current)

  return (
    <Card title="Безпека · активні сесії">
      {isLoading ? (
        <Skeleton style={{ height: 80 }} />
      ) : sessions.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Немає активних сесій.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid var(--wf-border)',
                borderRadius: 8,
              }}
            >
              <Icon name={s.current ? 'lock' : 'globe'} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{describeUserAgent(s.userAgent)}</span>
                  {s.current && (
                    <span
                      className="wfp-mono"
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 999,
                        border: '1px solid var(--wf-accent)',
                        color: 'var(--wf-accent)',
                      }}
                    >
                      поточна
                    </span>
                  )}
                </div>
                <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {s.ip ?? '—'} · вхід {formatDateTime(s.signedInAt)} · активність{' '}
                  {formatDateTime(s.lastActiveAt)}
                </div>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={revoke.isPending && revoke.variables === s.id}
                  onClick={() =>
                    revoke.mutate(s.id, {
                      onSuccess: () => toast.success('Сесію завершено'),
                      onError: () => toast.error('Не вдалося завершити сесію'),
                    })
                  }
                >
                  Завершити
                </Button>
              )}
            </div>
          ))}
          {others.length > 0 && (
            <div>
              <Button
                variant="ghost"
                loading={revokeOthers.isPending}
                onClick={() =>
                  revokeOthers.mutate(undefined, {
                    onSuccess: (r) => toast.success(`Завершено сесій: ${r.revoked}`),
                    onError: () => toast.error('Не вдалося завершити сесії'),
                  })
                }
              >
                Завершити всі інші ({others.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
