import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Icon, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { formatDate } from '@/lib/format'
import {
  useTwoFactorDisable,
  useTwoFactorEnable,
  useTwoFactorSetup,
  useTwoFactorStatus,
} from '@/lib/twoFactor'
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
import {
  usePaymentSettings,
  useReferralSettings,
  useSavePaymentSettings,
  useSaveReferralSettings,
  type PaymentSettings,
  type PaymentSettingsInput,
  type ReferralSettings,
} from '@/lib/settings'
import {
  LEGAL_TYPE_LABEL,
  useDeleteLegalEntity,
  useLegalEntities,
  useSaveLegalEntity,
  useSetDefaultLegalEntity,
  type LegalEntity,
  type LegalEntityInput,
} from '@/lib/legalEntities'

function PaymentForm({ initial }: { initial: PaymentSettings | null }) {
  const save = useSavePaymentSettings()
  const [bankName, setBankName] = useState(initial?.bankName ?? '')
  const [accountName, setAccountName] = useState(initial?.accountName ?? '')
  const [iban, setIban] = useState(initial?.iban ?? '')
  const [cryptoUsdt, setCryptoUsdt] = useState(initial?.cryptoUsdt ?? '')
  const [currency, setCurrency] = useState(initial?.invoiceCurrency ?? 'USD')
  const [terms, setTerms] = useState(initial?.paymentTermsDays?.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const submit = () => {
    const body: PaymentSettingsInput = {
      bankName: bankName.trim() || null,
      accountName: accountName.trim() || null,
      iban: iban.trim() || null,
      cryptoUsdt: cryptoUsdt.trim() || null,
      invoiceCurrency: currency,
      paymentTermsDays: terms.trim() === '' ? null : Number(terms),
      notes: notes.trim() || null,
    }
    save.mutate(body)
  }

  return (
    <Card title="Платіжні реквізити">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // це бачить клієнт у розділі «Як оплатити»
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Банк" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <Input
            label="Отримувач"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>
        <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="USDT-гаманець"
            value={cryptoUsdt}
            onChange={(e) => setCryptoUsdt(e.target.value)}
          />
          <Select
            label="Валюта рахунків"
            value={currency}
            onChange={setCurrency}
            options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Input
            label="Строк оплати, днів"
            type="number"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
          <Input label="Примітка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={submit}>
          Зберегти реквізити
        </Button>
        {save.isSuccess && (
          <span style={{ fontSize: 12, color: 'var(--wf-accent)' }}>Збережено ✓</span>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: 'var(--wf-destructive)' }}>Не вдалося зберегти.</span>
        )}
      </div>
    </Card>
  )
}

function ReferralForm({ initial }: { initial: ReferralSettings }) {
  const save = useSaveReferralSettings()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [employeePct, setEmployeePct] = useState(initial.employeeReferralPercent.toString())
  const [tiers, setTiers] = useState(
    initial.tiers.map((t) => ({
      minPaidUsd: t.minPaidUsd.toString(),
      percent: t.percent.toString(),
    }))
  )

  const setTier = (i: number, key: 'minPaidUsd' | 'percent', v: string) =>
    setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, [key]: v } : t)))
  const addTier = () => setTiers((prev) => [...prev, { minPaidUsd: '', percent: '' }])
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, j) => j !== i))

  const submit = () => {
    const parsedTiers = tiers
      .map((t) => ({ minPaidUsd: Number(t.minPaidUsd), percent: Number(t.percent) }))
      .filter((t) => Number.isFinite(t.minPaidUsd) && Number.isFinite(t.percent))
      .sort((a, b) => a.minPaidUsd - b.minPaidUsd)
    save.mutate({
      enabled,
      employeeReferralPercent: Number(employeePct) || 0,
      tiers: parsedTiers,
    })
  }

  return (
    <Card title="Реферальна програма">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // % бонусу рефереру за тіром обороту приведеного клієнта
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
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Програма активна
      </label>

      <div style={{ marginTop: 14 }}>
        <div
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
        >
          // тіри: від суми оплат ($) → % бонусу
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <Input
                placeholder="від $, напр. 5000"
                type="number"
                value={t.minPaidUsd}
                onChange={(e) => setTier(i, 'minPaidUsd', e.target.value)}
              />
              <Input
                placeholder="%, напр. 7"
                type="number"
                value={t.percent}
                onChange={(e) => setTier(i, 'percent', e.target.value)}
              />
              <Button variant="ghost" size="sm" onClick={() => removeTier(i)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={addTier} style={{ marginTop: 8 }}>
          + Додати тір
        </Button>
      </div>

      <div style={{ marginTop: 14, maxWidth: 280 }}>
        <Input
          label="Реферал-бонус працівника, %"
          type="number"
          value={employeePct}
          onChange={(e) => setEmployeePct(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={submit}>
          Зберегти програму
        </Button>
        {save.isSuccess && (
          <span style={{ fontSize: 12, color: 'var(--wf-accent)' }}>Збережено ✓</span>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: 'var(--wf-destructive)' }}>Не вдалося зберегти.</span>
        )}
      </div>
    </Card>
  )
}

function Pill({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'accent' | 'muted' | 'ok' | 'warn'
}) {
  const color =
    tone === 'accent'
      ? 'var(--wf-accent)'
      : tone === 'ok'
        ? 'var(--wf-success)'
        : tone === 'warn'
          ? 'var(--wf-warning)'
          : 'var(--wf-fg-secondary)'
  return (
    <span
      className="wfp-mono"
      style={{
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 999,
        border: '1px solid var(--wf-border)',
        color,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

const LEGAL_TYPE_OPTIONS = ['fop', 'tov', 'individual', 'foreign'].map((v) => ({
  value: v,
  label: LEGAL_TYPE_LABEL[v] ?? v,
}))

function EntityModal({ entity, onClose }: { entity: LegalEntity | null; onClose: () => void }) {
  const save = useSaveLegalEntity()
  const editing = entity != null
  const [name, setName] = useState(entity?.name ?? '')
  const [legalType, setLegalType] = useState(entity?.legalType ?? 'fop')
  const [legalName, setLegalName] = useState(entity?.legalName ?? '')
  const [taxId, setTaxId] = useState(entity?.taxId ?? '')
  const [vatPayer, setVatPayer] = useState(entity?.vatPayer ?? false)
  const [vatId, setVatId] = useState(entity?.vatId ?? '')
  const [legalAddress, setLegalAddress] = useState(entity?.legalAddress ?? '')
  const [bankName, setBankName] = useState(entity?.bankName ?? '')
  const [iban, setIban] = useState(entity?.iban ?? '')
  const [signerName, setSignerName] = useState(entity?.signerName ?? '')
  const [signerTitle, setSignerTitle] = useState(entity?.signerTitle ?? '')

  const nameInvalid = name.trim().length < 2
  const legalNameInvalid = legalName.trim().length < 2

  const submit = () => {
    if (nameInvalid || legalNameInvalid) return
    const body: LegalEntityInput & { id?: string } = {
      id: entity?.id,
      name: name.trim(),
      legalType,
      legalName: legalName.trim(),
      taxId: taxId.trim() || null,
      vatPayer,
      vatId: vatPayer ? vatId.trim() || null : null,
      legalAddress: legalAddress.trim() || null,
      bankName: bankName.trim() || null,
      iban: iban.trim() || null,
      signerName: signerName.trim() || null,
      signerTitle: signerTitle.trim() || null,
    }
    save.mutate(body, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Редагувати юр-особу' : 'Нова юр-особа'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Скасувати
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? 'Зберегти' : 'Додати'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          // для генерації документів потрібні: юр-назва, ІПН/ЄДРПОУ, IBAN, підписант
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Назва (внутрішня)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameInvalid ? 'мін. 2 символи' : undefined}
          />
          <Select
            label="Тип"
            value={legalType}
            onChange={setLegalType}
            options={LEGAL_TYPE_OPTIONS}
          />
        </div>
        <Input
          label="Юридична назва"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          error={legalNameInvalid ? 'мін. 2 символи' : undefined}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="ІПН / ЄДРПОУ" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              cursor: 'pointer',
              alignSelf: 'end',
              paddingBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={vatPayer}
              onChange={(e) => setVatPayer(e.target.checked)}
            />
            Платник ПДВ
          </label>
        </div>
        {vatPayer && (
          <Input label="ІПН ПДВ" value={vatId} onChange={(e) => setVatId(e.target.value)} />
        )}
        <Input
          label="Юридична адреса"
          value={legalAddress}
          onChange={(e) => setLegalAddress(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Input label="Банк" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
        </div>
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
        {save.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
            Не вдалося зберегти — перевірте поля.
          </div>
        )}
      </div>
    </Modal>
  )
}

function LegalEntitiesSection() {
  const { entities, isLoading, isError } = useLegalEntities()
  const setDefault = useSetDefaultLegalEntity()
  const del = useDeleteLegalEntity()
  const [modal, setModal] = useState<{ entity: LegalEntity | null } | null>(null)

  return (
    <Card title="Юр-особи агенції">
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // ФОП/ТОВ, від яких виставляються рахунки й акти · дефолтна успадковується проєктами
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 120 }} />
      ) : isError ? (
        <EmptyState
          glyph="// error"
          title="Не вдалося завантажити юр-особи"
          description="Спробуйте оновити сторінку."
        />
      ) : entities.length === 0 ? (
        <EmptyState
          title="Ще немає юр-осіб"
          description="Додайте ФОП/ТОВ, щоб виставляти документи."
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {entities.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid var(--wf-border)',
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>{e.name}</span>
                  <Pill>{LEGAL_TYPE_LABEL[e.legalType] ?? e.legalType}</Pill>
                  {e.isDefault && <Pill tone="accent">★ дефолтна</Pill>}
                  {e.isComplete ? (
                    <Pill tone="ok">✓ готова</Pill>
                  ) : (
                    <Pill tone="warn">чернетка</Pill>
                  )}
                  {!e.active && <Pill>неактивна</Pill>}
                </div>
                <div
                  className="wfp-mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--wf-fg-muted)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {e.legalName}
                  {e.taxId ? ` · ${e.taxId}` : ''}
                  {e.iban ? ` · ${e.iban}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!e.isDefault && e.active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={setDefault.isPending}
                    onClick={() => setDefault.mutate(e.id)}
                  >
                    Зробити дефолтною
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setModal({ entity: e })}>
                  Редагувати
                </Button>
                {!e.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Видалити юр-особу «${e.name}»?`)) del.mutate(e.id)
                    }}
                  >
                    ✕
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setModal({ entity: null })}
        style={{ marginTop: 12 }}
      >
        + Додати юр-особу
      </Button>
      {(setDefault.isError || del.isError) && (
        <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 8 }}>
          Дію не виконано (напр. не можна видалити дефолтну або юр-особу з документами).
        </div>
      )}

      {modal && <EntityModal entity={modal.entity} onClose={() => setModal(null)} />}
    </Card>
  )
}

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
    <Card title="Сповіщення">
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
        // The link completes async via the bot — re-check shortly after the user returns.
        setTimeout(() => void qc.invalidateQueries({ queryKey: ['telegram-status'] }), 8000)
      },
      onError: () => toast.error('Не вдалося створити посилання'),
    })

  return (
    <Card title="Telegram-сповіщення">
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
                Підключіть Telegram, щоб отримувати миттєві сповіщення про замовлення.
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
function SecuritySection() {
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
    <Card title="Безпека · двофакторна автентифікація">
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
            Захистіть акаунт кодом із застосунку-автентифікатора на додачу до пароля. Особливо
            важливо, бо ви маєте доступ до секретів клієнтів (сховище).
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

export function SettingsPage() {
  const payment = usePaymentSettings()
  const referral = useReferralSettings()

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Налаштування</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // юр-особи, реквізити для оплати та реферальна програма
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <SecuritySection />
        <LegalEntitiesSection />
        {payment.isLoading ? (
          <Skeleton style={{ height: 200 }} />
        ) : (
          <PaymentForm initial={payment.data?.settings ?? null} />
        )}
        {referral.isLoading ? (
          <Skeleton style={{ height: 200 }} />
        ) : referral.data ? (
          <ReferralForm initial={referral.data} />
        ) : null}
        <NotificationsSection />
        <TelegramSection />
      </div>
    </div>
  )
}
