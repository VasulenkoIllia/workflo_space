import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  LinkedAccountsSection,
  NotificationsSection,
  SessionsSection,
  TelegramSection,
  TwoFactorSection,
} from '@workflo/app-core'
import { Button, Card, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import {
  DocumentTemplatesSection,
  EmailTemplatesSection,
  PdfBrandingSection,
} from '@/routes/settings/DocumentTemplatesSection'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import {
  useCreateOrderTag,
  useCreateOrderTemplate,
  useDeleteOrderTag,
  useDeleteOrderTemplate,
  useOrderTags,
  useOrderTemplates,
} from '@/lib/orders'
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

/** 2FA-POLICY (owner-only): «вимагати 2FA у команди» + хто з команди вже захищений.
 * Увімкнення дає кожному члену без TOTP грейс 7 днів (банер), далі вхід веде одразу
 * в налаштування 2FA. Клієнтів порталу політика не стосується. */
interface AgencySecurity {
  requireTwoFactor: boolean
  since: string | null
  deadline: string | null
  members: { profileId: string; name: string; twoFactorEnabled: boolean }[]
}

function AgencySecuritySection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['agency-security'],
    queryFn: () => api.get<AgencySecurity>('/workspace/agency/security'),
  })
  const patch = useMutation({
    mutationFn: (requireTwoFactor: boolean) =>
      api.patch('/workspace/agency/security', { requireTwoFactor }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agency-security'] }),
  })

  if (isLoading) return <Skeleton style={{ height: 120 }} />
  if (!data) return null
  const unprotected = data.members.filter((m) => !m.twoFactorEnabled)

  return (
    <Card title="Безпека агенції · 2FA">
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={data.requireTwoFactor}
          disabled={patch.isPending}
          onChange={(e) => {
            const next = e.target.checked
            if (
              next &&
              !window.confirm(
                `Вимагати 2FA у всієї команди? Хто ще не налаштував (${unprotected.length}) — матиме 7 днів, далі вхід вестиме одразу в налаштування 2FA.`
              )
            )
              return
            patch.mutate(next, {
              onSuccess: () =>
                toast.success(next ? 'Політику ввімкнено — грейс 7 днів' : 'Політику вимкнено'),
            })
          }}
        />
        Вимагати двофакторну автентифікацію у команди
      </label>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        {data.requireTwoFactor && data.deadline
          ? `// діє з ${formatDate(data.since ?? '')} · дедлайн для команди: ${formatDate(data.deadline)} · клієнтів порталу не стосується`
          : '// стосується owner/manager/виконавців; клієнтів порталу — ні. Грейс 7 днів, далі вхід веде в налаштування 2FA.'}
      </div>
      <div style={{ display: 'grid', gap: 4, marginTop: 12 }}>
        {data.members.map((m) => (
          <div key={m.profileId} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <span
              className="wfp-mono"
              style={{
                fontSize: 11,
                color: m.twoFactorEnabled ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
                width: 70,
              }}
            >
              {m.twoFactorEnabled ? '✓ 2FA' : '— без 2FA'}
            </span>
            {m.name}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** S11 (owner-only): тумблер «місячний звіт на email» — cron шле власникам дайджест
 * за попередній місяць (замовлення/гроші/ліди/SLA). */
function EmailReportsSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['agency-report-settings'],
    queryFn: () =>
      api.get<{
        monthlyReportEnabled: boolean
        monthlyReportLastSentAt: string | null
        clientMonthlyReportEnabled: boolean
        clientMonthlyReportLastSentAt: string | null
      }>('/workspace/agency/report-settings'),
  })
  const patch = useMutation({
    mutationFn: (body: { monthlyReportEnabled?: boolean; clientMonthlyReportEnabled?: boolean }) =>
      api.patch('/workspace/agency/report-settings', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agency-report-settings'] }),
  })

  if (isLoading) return <Skeleton style={{ height: 80 }} />
  if (!data) return null

  const lastNote = (at: string | null): string =>
    at ? `Останній: ${formatDate(at)}` : 'Ще не надсилався.'

  return (
    <Card title="Звіти на email">
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={data.monthlyReportEnabled}
          disabled={patch.isPending}
          onChange={(e) =>
            patch.mutate(
              { monthlyReportEnabled: e.target.checked },
              {
                onSuccess: () =>
                  toast.success(
                    e.target.checked
                      ? 'Місячний звіт увімкнено — перший лист прийде на наступному прогоні'
                      : 'Місячний звіт вимкнено'
                  ),
              }
            )
          }
        />
        Місячний звіт власникам на email
      </label>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        // дайджест за попередній місяць: замовлення · гроші · ліди · SLA.{' '}
        {lastNote(data.monthlyReportLastSentAt)}
      </div>

      {/* 19-Г: місячний звіт КЛІЄНТАМ — PDF-документ + лист кожній активній компанії */}
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginTop: 14 }}
      >
        <input
          type="checkbox"
          checked={data.clientMonthlyReportEnabled}
          disabled={patch.isPending}
          onChange={(e) =>
            patch.mutate(
              { clientMonthlyReportEnabled: e.target.checked },
              {
                onSuccess: () =>
                  toast.success(
                    e.target.checked
                      ? 'Звіти клієнтам увімкнено — листи підуть на наступному прогоні'
                      : 'Звіти клієнтам вимкнено'
                  ),
              }
            )
          }
        />
        Місячний звіт клієнтам (PDF на email)
      </label>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        // кожній активній компанії: що зроблено · години · оплати · борг. На «Email для документів»
        з реквізитів (або власникам компанії). {lastNote(data.clientMonthlyReportLastSentAt)}
      </div>
    </Card>
  )
}

/** 06-ПІДПИС (owner-only): договір-гейт — «без прийнятого договору робота не стартує».
 * Рамкова семантика: accepted-договір КОМПАНІЇ (не per-order). */
function WorkflowSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['agency-workflow-settings'],
    queryFn: () =>
      api.get<{ requireSignedContract: boolean; autoInvoiceOneTime: boolean }>(
        '/workspace/agency/workflow-settings'
      ),
  })
  const patch = useMutation({
    mutationFn: (body: { requireSignedContract?: boolean; autoInvoiceOneTime?: boolean }) =>
      api.patch('/workspace/agency/workflow-settings', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agency-workflow-settings'] }),
  })

  if (isLoading) return <Skeleton style={{ height: 70 }} />
  if (!data) return null

  return (
    <Card title="Воркфлоу · договір">
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={data.requireSignedContract}
          disabled={patch.isPending}
          onChange={(e) =>
            patch.mutate(
              { requireSignedContract: e.target.checked },
              {
                onSuccess: () =>
                  toast.success(
                    e.target.checked ? 'Договір-гейт увімкнено' : 'Договір-гейт вимкнено'
                  ),
              }
            )
          }
        />
        Вимагати прийнятий договір до старту роботи
      </label>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        // замовлення клієнта не перейде «в роботу», поки компанія не прийняла договір у порталі
        (клік + ПІБ). Внутрішніх замовлень не стосується.
      </div>

      {/* АВТО-РАХУНОК (07.07): разове замовлення done → чернетка рахунку + in-app */}
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginTop: 14 }}
      >
        <input
          type="checkbox"
          checked={data.autoInvoiceOneTime}
          disabled={patch.isPending}
          onChange={(e) =>
            patch.mutate(
              { autoInvoiceOneTime: e.target.checked },
              {
                onSuccess: () =>
                  toast.success(
                    e.target.checked ? 'Авто-рахунок увімкнено' : 'Авто-рахунок вимкнено'
                  ),
              }
            )
          }
        />
        Авто-рахунок при завершенні разового замовлення
      </label>
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        // замовлення без проекту перейшло у «виконано» → чернетка рахунку (фікс = погоджена сума;
        погодинка = факт годин × ставка) + сповіщення «перевір і надішли». Клієнту нічого не летить
        автоматично.
      </div>
    </Card>
  )
}

/** 05-Б дунінг: офсети кроків нагадувань від dueDate (відʼємні = до терміну).
 * Порожньо = вимкнено; «Повернути дефолт» = системний ланцюжок. */
function DunningSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['agency-dunning-settings'],
    queryFn: () =>
      api.get<{ steps: number[]; isDefault: boolean; defaultSteps: number[] }>(
        '/workspace/agency/dunning-settings'
      ),
  })
  const [raw, setRaw] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (steps: number[] | null) =>
      api.put('/workspace/agency/dunning-settings', { steps }),
    onSuccess: () => {
      toast.success('Налаштування нагадувань збережено')
      setRaw(null)
      void qc.invalidateQueries({ queryKey: ['agency-dunning-settings'] })
    },
    onError: () => toast.error('Не вдалося зберегти'),
  })

  if (isLoading) return <Skeleton style={{ height: 90 }} />
  if (!data) return null

  const value = raw ?? data.steps.join(', ')
  const parsed = value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number)
  const valid = parsed.every((n) => Number.isInteger(n) && n >= -30 && n <= 60)

  return (
    <Card title="Нагадування про оплату">
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // дні відносно терміну оплати: відʼємні = до, 0 = у день, додатні = після. На останньому
        кроці — ескалація власнику. Порожньо = нагадування вимкнено. Текст листа редагується в
        «Email-шаблони».
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <Input
            label="Кроки (через кому)"
            value={value}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="-3, 0, 3, 7, 14"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={raw === null || !valid}
          loading={save.isPending}
          onClick={() => save.mutate(parsed)}
        >
          Зберегти
        </Button>
        {!data.isDefault && (
          <Button variant="ghost" size="sm" onClick={() => save.mutate(null)}>
            Повернути дефолт ({data.defaultSteps.join(', ')})
          </Button>
        )}
      </div>
      {!valid && (
        <div style={{ fontSize: 12, color: 'var(--wf-danger, #e5484d)', marginTop: 6 }}>
          Кроки — цілі числа від -30 до 60
        </div>
      )}
    </Card>
  )
}

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

export function SettingsPage() {
  const payment = usePaymentSettings()
  const referral = useReferralSettings()
  const { isOwner } = useAuth()

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
        <TwoFactorSection app="workspace" />
        {isOwner && <AgencySecuritySection />}
        {isOwner && <EmailReportsSection />}
        {isOwner && <WorkflowSection />}
        {isOwner && <DunningSection />}
        {isOwner && <DocumentTemplatesSection />}
        {isOwner && <PdfBrandingSection />}
        {isOwner && <EmailTemplatesSection />}
        {isOwner && <OrderCatalogSection />}
        {isOwner && <SlaPoliciesSection />}
        <LinkedAccountsSection app="workspace" />
        <SessionsSection />
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
        <TelegramSection app="workspace" />
      </div>
    </div>
  )
}

/** S10-01: каталоги замовлень — теги (name+color) і шаблони (name+title+price). Owner-only. */
function OrderCatalogSection() {
  const tags = useOrderTags()
  const createTag = useCreateOrderTag()
  const deleteTag = useDeleteOrderTag()
  const templates = useOrderTemplates()
  const createTemplate = useCreateOrderTemplate()
  const deleteTemplate = useDeleteOrderTemplate()
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#a3d90d')
  const [tplName, setTplName] = useState('')
  const [tplTitle, setTplTitle] = useState('')
  const [tplPrice, setTplPrice] = useState('')

  return (
    <Card title="Замовлення · теги і шаблони">
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
          >
            ТЕГИ (фільтр і чіпи на замовленнях)
          </div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            {(tags.data?.tags ?? []).map((t) => (
              <div
                key={t.id}
                style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: t.color ?? 'var(--wf-fg-muted)',
                  }}
                />
                <span style={{ flex: 1 }}>{t.name}</span>
                <button
                  type="button"
                  className="wfp-link"
                  style={{ fontSize: 11, color: 'var(--wf-destructive)' }}
                  onClick={() => {
                    if (window.confirm(`Видалити тег «${t.name}»? Він зніметься з усіх замовлень.`))
                      deleteTag.mutate(t.id)
                  }}
                >
                  видалити
                </button>
              </div>
            ))}
            {(tags.data?.tags.length ?? 0) === 0 && (
              <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                // тегів ще немає
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Новий тег"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
            </div>
            <input
              type="color"
              aria-label="Колір тега"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              style={{
                width: 36,
                height: 34,
                border: '1px solid var(--wf-border)',
                borderRadius: 6,
                background: 'none',
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={createTag.isPending}
              onClick={() => {
                if (tagName.trim() === '') return
                createTag.mutate(
                  { name: tagName.trim(), color: tagColor },
                  {
                    onSuccess: () => {
                      setTagName('')
                      toast.success('Тег додано')
                    },
                  }
                )
              }}
            >
              Додати
            </Button>
          </div>
        </div>

        <div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
          >
            ШАБЛОНИ (пресети «Нового замовлення»)
          </div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            {(templates.data?.templates ?? []).map((t) => (
              <div
                key={t.id}
                style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13 }}
              >
                <span style={{ flex: 1 }}>
                  {t.name}
                  <span
                    className="wfp-mono"
                    style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
                  >
                    {t.defaultTitle}
                    {t.defaultPrice ? ` · $${t.defaultPrice}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="wfp-link"
                  style={{ fontSize: 11, color: 'var(--wf-destructive)' }}
                  onClick={() => {
                    if (window.confirm(`Видалити шаблон «${t.name}»?`)) deleteTemplate.mutate(t.id)
                  }}
                >
                  видалити
                </button>
              </div>
            ))}
            {(templates.data?.templates.length ?? 0) === 0 && (
              <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                // шаблонів ще немає
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <Input
                label="Назва шаблону"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
              <Input
                label="Сума (фікс, опц.)"
                inputMode="decimal"
                value={tplPrice}
                onChange={(e) => setTplPrice(e.target.value)}
              />
            </div>
            <Input
              label="Назва замовлення за замовчуванням"
              value={tplTitle}
              onChange={(e) => setTplTitle(e.target.value)}
            />
            <div>
              <Button
                variant="secondary"
                size="sm"
                loading={createTemplate.isPending}
                onClick={() => {
                  if (tplName.trim() === '' || tplTitle.trim() === '') {
                    toast.error('Назва шаблону і назва замовлення обовʼязкові')
                    return
                  }
                  const price = tplPrice.trim() === '' ? null : Number(tplPrice.replace(',', '.'))
                  if (price != null && (!Number.isFinite(price) || price < 0)) {
                    toast.error('Сума: невідʼємне число')
                    return
                  }
                  createTemplate.mutate(
                    { name: tplName.trim(), defaultTitle: tplTitle.trim(), defaultPrice: price },
                    {
                      onSuccess: () => {
                        setTplName('')
                        setTplTitle('')
                        setTplPrice('')
                        toast.success('Шаблон додано')
                      },
                    }
                  )
                }}
              >
                Додати шаблон
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

/** S10-02: SLA-політики per-пріоритет (owner). Хвилини до першої відповіді / розв'язання;
 * штампуються на НОВІ замовлення цього пріоритету (наявні не перештамповуються). */
const SLA_PRIORITIES = [
  { value: 'urgent', label: 'Терміновий' },
  { value: 'high', label: 'Високий' },
  { value: 'medium', label: 'Середній' },
  { value: 'low', label: 'Низький' },
] as const

function SlaPoliciesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['sla-policies'],
    queryFn: () =>
      api.get<{
        policies: { priority: string; firstResponseMins: number; resolutionMins: number }[]
      }>('/workspace/sla-policies'),
  })
  const upsert = useMutation({
    mutationFn: (body: { priority: string; firstResponseMins: number; resolutionMins: number }) =>
      api.put('/workspace/sla-policies', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sla-policies'] }),
  })
  const remove = useMutation({
    mutationFn: (priority: string) => api.delete(`/workspace/sla-policies/${priority}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sla-policies'] }),
  })
  const [draft, setDraft] = useState<Record<string, { fr: string; res: string }>>({})

  if (isLoading) return <Skeleton style={{ height: 140 }} />
  const byPriority = new Map((data?.policies ?? []).map((p) => [p.priority, p]))

  return (
    <Card title="SLA · терміни реакції">
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
      >
        // хвилини до першої відповіді команди і до розв'язання; діють на НОВІ замовлення
        пріоритету. Прострочення → breach-позначка + сповіщення власнику (перевірка кожні 15 хв).
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {SLA_PRIORITIES.map(({ value, label }) => {
          const existing = byPriority.get(value)
          const d = draft[value] ?? {
            fr: existing ? String(existing.firstResponseMins) : '',
            res: existing ? String(existing.resolutionMins) : '',
          }
          const setD = (patch: Partial<{ fr: string; res: string }>) =>
            setDraft((prev) => ({ ...prev, [value]: { ...d, ...patch } }))
          return (
            <div key={value} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <span style={{ width: 110, fontSize: 13, paddingBottom: 8 }}>
                {label}
                {existing && (
                  <span
                    className="wfp-mono"
                    style={{ fontSize: 10, color: 'var(--wf-accent)', marginLeft: 6 }}
                  >
                    ✓
                  </span>
                )}
              </span>
              <div style={{ width: 150 }}>
                <Input
                  label="1-ша відповідь, хв"
                  inputMode="numeric"
                  value={d.fr}
                  onChange={(e) => setD({ fr: e.target.value })}
                />
              </div>
              <div style={{ width: 150 }}>
                <Input
                  label="Розв'язання, хв"
                  inputMode="numeric"
                  value={d.res}
                  onChange={(e) => setD({ res: e.target.value })}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={upsert.isPending}
                onClick={() => {
                  const fr = Number(d.fr)
                  const res = Number(d.res)
                  if (!Number.isInteger(fr) || !Number.isInteger(res) || fr < 5 || res < fr) {
                    toast.error('Хвилини: цілі числа, ≥5, розв\u2019язання ≥ першої відповіді')
                    return
                  }
                  upsert.mutate(
                    { priority: value, firstResponseMins: fr, resolutionMins: res },
                    { onSuccess: () => toast.success(`SLA для «${label}» збережено`) }
                  )
                }}
              >
                Зберегти
              </Button>
              {existing && (
                <button
                  type="button"
                  className="wfp-link"
                  style={{ fontSize: 11, color: 'var(--wf-destructive)', paddingBottom: 10 }}
                  onClick={() =>
                    remove.mutate(value, {
                      onSuccess: () => {
                        setDraft((prev) => ({ ...prev, [value]: { fr: '', res: '' } }))
                        toast.success('Політику знято')
                      },
                    })
                  }
                >
                  зняти
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
