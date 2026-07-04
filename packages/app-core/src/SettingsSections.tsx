import { useEffect, useState, type CSSProperties } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, Icon, Input, Skeleton } from '@workflo/ui'
import { useSearchParams } from 'react-router-dom'
import { formatDate, formatDateTime } from './format.js'
import {
  describeUserAgent,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from './sessions.js'
import {
  useTwoFactorDisable,
  useTwoFactorEnable,
  useTwoFactorSetup,
  useTwoFactorStatus,
} from './twoFactor.js'
import { startGoogleLink, useOauthAccounts, useOauthProviders, useUnlinkOauth } from './oauth.js'
import { useTelegramConnect, useTelegramDisconnect, useTelegramStatus } from './telegram.js'
import {
  LOCKED_EMAIL,
  NOTIF_CATEGORIES,
  NOTIF_CHANNELS,
  prefKey,
  useNotificationPrefs,
  useSaveNotificationPrefs,
  type NotifCategory,
  type NotifChannel,
} from './notificationPrefs.js'

/**
 * Shared Settings sections (AR-42). These six section components were byte-near-identical
 * copies in workspace + portal SettingsPage. The single source lives here; each app keeps
 * a thin page wrapper. App-specific differences (Card `marginBottom` in portal's flow layout
 * vs workspace's grid, and one line of security copy) are parameterised by `cardStyle` +
 * `app` props so the rendered DOM per app is unchanged.
 */
export type SettingsApp = 'portal' | 'workspace'

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

export function NotificationsSection({ cardStyle }: { cardStyle?: CSSProperties }) {
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
    <Card title="Сповіщення" style={cardStyle}>
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

export function TelegramSection({
  app,
  cardStyle,
}: {
  app: SettingsApp
  cardStyle?: CSSProperties
}) {
  const qc = useQueryClient()
  const { data: status, isLoading } = useTelegramStatus()
  const connect = useTelegramConnect()
  const disconnect = useTelegramDisconnect()

  const onConnect = () =>
    connect.mutate(undefined, {
      onSuccess: (r) => {
        window.open(r.deepLink, '_blank')
        toast.info('Відкрийте Telegram і натисніть «Start», потім поверніться сюди')
        // The link completes async via the bot — re-check shortly after the user returns.
        setTimeout(() => void qc.invalidateQueries({ queryKey: ['telegram-status'] }), 8000)
      },
      onError: () => toast.error('Не вдалося створити посилання'),
    })

  return (
    <Card title="Telegram-сповіщення" style={cardStyle}>
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
                {app === 'portal'
                  ? 'Підключіть Telegram, щоб отримувати миттєві сповіщення про ваші замовлення.'
                  : 'Підключіть Telegram, щоб отримувати миттєві сповіщення про замовлення.'}
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

/**
 * Двофакторна автентифікація (S9-01). Setup: показ QR (otpauth) + секрет для ручного
 * вводу → підтвердження першим кодом → одноразові резервні коди (показуються ЄДИНИЙ раз).
 * Disable: код 2FA або пароль акаунта. QR-ліба тягнеться ліниво лише на екрані setup.
 */
export function TwoFactorSection({
  app,
  cardStyle,
}: {
  app: SettingsApp
  cardStyle?: CSSProperties
}) {
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
      // Lazy-load QR renderer only when a user actually starts setup.
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
    <Card title="Безпека · двофакторна автентифікація" style={cardStyle}>
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
            {app === 'workspace'
              ? 'Захистіть акаунт кодом із застосунку-автентифікатора на додачу до пароля. Особливо важливо, бо ви маєте доступ до секретів клієнтів (сховище).'
              : 'Захистіть акаунт кодом із застосунку-автентифікатора на додачу до пароля.'}
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

/**
 * Активні сесії (S9-02): одна картка на живий пристрій (refresh-token family).
 * Revoke гасить refresh-токен — пристрій вилетить на найближчому оновленні
 * сесії (до 15 хв, поки живе access-токен).
 */
export function SessionsSection({ cardStyle }: { cardStyle?: CSSProperties }) {
  const { data, isLoading } = useSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const sessions = data?.sessions ?? []
  const others = sessions.filter((s) => !s.current)

  return (
    <Card title="Безпека · активні сесії" style={cardStyle}>
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

/**
 * Соц-входи (S9 §E): привʼязка/відвʼязка Google. Відвʼязка вимагає пароль —
 * гарантія, що лишається ≥1 робочий спосіб входу. Картка ховається, коли
 * OAuth не налаштовано і нічого не привʼязано.
 */
export function LinkedAccountsSection({
  app,
  cardStyle,
}: {
  app: SettingsApp
  cardStyle?: CSSProperties
}) {
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
    <Card title="Безпека · способи входу" style={cardStyle}>
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
