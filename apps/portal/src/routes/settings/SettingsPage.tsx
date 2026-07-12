import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Locale } from '@workflo/i18n'
import {
  EmailChangeSection,
  LinkedAccountsSection,
  NotificationsSection,
  PasswordSection,
  SessionsSection,
  TelegramSection,
  TwoFactorSection,
} from '@workflo/app-core'
import { Button, Card, Input, Skeleton, useTheme, type ThemeMode } from '@workflo/ui'
import { api, API_URL, getAccessToken } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/i18n'
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

      <NotificationsSection cardStyle={{ marginBottom: 16 }} />

      <TelegramSection app="portal" cardStyle={{ marginBottom: 16 }} />

      <PasswordSection cardStyle={{ marginBottom: 16 }} />

      <EmailChangeSection
        currentEmail={user?.profile.email ?? ''}
        pendingEmail={user?.pendingEmail}
        cardStyle={{ marginBottom: 16 }}
      />

      <TwoFactorSection app="portal" cardStyle={{ marginBottom: 16 }} />

      <LinkedAccountsSection app="portal" cardStyle={{ marginBottom: 16 }} />

      <DataExportSection />

      <SessionsSection />
    </div>
  )
}

/** S9-06 GDPR: вивантаження власних даних одним JSON-файлом. */
function DataExportSection() {
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_URL}/profile/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) throw new Error('export failed')
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'workflo-my-data.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('Не вдалося сформувати експорт')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="Мої дані (GDPR)" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', margin: '0 0 12px' }}>
        Завантажте копію своїх персональних даних (профіль, налаштування, членства, ваші сповіщення
        й повідомлення) одним JSON-файлом. Секрети (паролі, дані сейфа) не включаються.
      </p>
      <Button variant="secondary" loading={busy} onClick={() => void download()}>
        Завантажити мої дані
      </Button>
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
