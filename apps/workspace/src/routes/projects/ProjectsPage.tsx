import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { formatMoney } from '@/lib/format'
import {
  num,
  useCompanies,
  useProjects,
  useSaveProject,
  type FinProject,
  type ProjectInput,
} from '@/lib/projects'

const MODEL_LABEL: Record<string, string> = {
  fixed_monthly_advance: 'Абонплата (аванс)',
  hourly_prepaid: 'Погодинно (аванс)',
  hourly_postpaid: 'Погодинно (факт)',
}
const CYCLE_LABEL: Record<string, string> = {
  monthly_day_n: 'Щомісяця',
  weekly_day_x: 'Щотижня',
  manual: 'Вручну',
}
const MODE_LABEL: Record<string, string> = {
  none: 'Без погодження',
  upfront: 'Перед стартом',
  on_actuals: 'Перед рахунком',
}
const APPROVER_LABEL: Record<string, string> = { client: 'Клієнт', internal: 'Команда' }

/** Labelled native select (no Select in @workflo/ui yet — styled via tokens). */
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {label.toUpperCase()}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--wf-surface)',
          color: 'var(--wf-fg)',
          border: '1px solid var(--wf-border)',
          borderRadius: 'var(--wf-radius)',
          padding: '8px 10px',
          fontSize: 14,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ProjectModal({
  project,
  companies,
  onClose,
}: {
  project: FinProject | null
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const save = useSaveProject()
  const editing = project != null
  const [companyId, setCompanyId] = useState(project?.companyId ?? companies[0]?.id ?? '')
  const [name, setName] = useState(project?.name ?? '')
  const [model, setModel] = useState<FinProject['billingModel']>(
    project?.billingModel ?? 'hourly_postpaid'
  )
  const [currency, setCurrency] = useState(project?.currency ?? 'USD')
  const [rate, setRate] = useState(project?.clientHourlyRate ?? '')
  const [abon, setAbon] = useState(project?.abonAmount ?? '')
  const [cycle, setCycle] = useState<FinProject['billingCycle']>(
    project?.billingCycle ?? 'monthly_day_n'
  )
  // '' = успадкувати (каскад компанія → агенція, P-11); явне значення закріплює цей проєкт.
  const [mode, setMode] = useState<'' | NonNullable<FinProject['approvalMode']>>(
    project?.approvalMode ?? ''
  )
  const [approver, setApprover] = useState<NonNullable<FinProject['invoiceApprover']>>(
    project?.invoiceApprover ?? 'internal'
  )

  const isFixed = model === 'fixed_monthly_advance'
  const nameInvalid = name.trim().length < 2
  const moneyInvalid = isFixed ? !(Number(abon) > 0) : !(Number(rate) > 0)

  const submit = () => {
    if (nameInvalid || moneyInvalid || !companyId) return
    const body: ProjectInput & { id?: string } = {
      id: project?.id,
      name: name.trim(),
      currency,
      billingCycle: cycle,
      approvalMode: mode === '' ? null : mode,
      invoiceApprover: approver,
      abonAmount: isFixed ? Number(abon) : null,
      clientHourlyRate: isFixed ? null : Number(rate),
      ...(editing ? {} : { companyId, billingModel: model }),
    }
    save.mutate(body, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Редагувати проєкт' : 'Новий фін-проєкт'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Скасувати
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? 'Зберегти' : 'Створити'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {!editing && (
          <Select
            label="Клієнт"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
        <Input
          label="Назва проєкту"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameInvalid ? 'Мінімум 2 символи' : undefined}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {!editing && (
            <Select
              label="Модель"
              value={model}
              onChange={(v) => setModel(v as FinProject['billingModel'])}
              options={Object.entries(MODEL_LABEL).map(([value, label]) => ({ value, label }))}
            />
          )}
          {isFixed ? (
            <Input
              label="Абонплата / міс"
              type="number"
              value={abon}
              onChange={(e) => setAbon(e.target.value)}
              error={moneyInvalid ? '> 0' : undefined}
            />
          ) : (
            <Input
              label="Ставка / год"
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              error={moneyInvalid ? '> 0' : undefined}
            />
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select
            label="Цикл"
            value={cycle}
            onChange={(v) => setCycle(v as FinProject['billingCycle'])}
            options={Object.entries(CYCLE_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Валюта"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'UAH', label: 'UAH' },
              { value: 'EUR', label: 'EUR' },
            ]}
          />
        </div>
        <div
          style={{
            borderTop: '1px solid var(--wf-border)',
            paddingTop: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <Select
            label="Погодження вартості"
            value={mode}
            onChange={(v) => setMode(v as '' | NonNullable<FinProject['approvalMode']>)}
            options={[
              { value: '', label: 'Успадкувати (за замовч.)' },
              ...Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
          {mode === 'on_actuals' && (
            <Select
              label="Хто погоджує рахунок"
              value={approver}
              onChange={(v) => setApprover(v as NonNullable<FinProject['invoiceApprover']>)}
              options={Object.entries(APPROVER_LABEL).map(([value, label]) => ({ value, label }))}
            />
          )}
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

const WIZARD_STEPS = ['Клієнт', 'Модель і гроші', 'Цикл і погодження', 'Огляд']

/** Multi-step create wizard (design-v2). Edit still uses the single-form ProjectModal. */
function ProjectWizard({
  companies,
  onClose,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const save = useSaveProject()
  const [step, setStep] = useState(0)
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [model, setModel] = useState<FinProject['billingModel']>('hourly_postpaid')
  const [currency, setCurrency] = useState('USD')
  const [rate, setRate] = useState('')
  const [abon, setAbon] = useState('')
  const [cycle, setCycle] = useState<FinProject['billingCycle']>('monthly_day_n')
  const [terms, setTerms] = useState('')
  const [mode, setMode] = useState<'' | NonNullable<FinProject['approvalMode']>>('')
  const [approver, setApprover] = useState<NonNullable<FinProject['invoiceApprover']>>('internal')

  const isFixed = model === 'fixed_monthly_advance'
  const step0Valid = name.trim().length >= 2 && !!companyId
  const step1Valid = isFixed ? Number(abon) > 0 : Number(rate) > 0
  const stepValid = [step0Valid, step1Valid, true, true][step] ?? true
  const last = step === WIZARD_STEPS.length - 1

  const submit = () => {
    const body: ProjectInput & { id?: string } = {
      companyId,
      billingModel: model,
      name: name.trim(),
      type: type.trim() || null,
      currency,
      billingCycle: cycle,
      paymentTermsDays: terms.trim() === '' ? null : Number(terms),
      approvalMode: mode === '' ? null : mode,
      invoiceApprover: approver,
      abonAmount: isFixed ? Number(abon) : null,
      clientHourlyRate: isFixed ? null : Number(rate),
    }
    save.mutate(body, { onSuccess: onClose })
  }

  const money = isFixed ? `${formatMoney(num(abon))}/міс` : `${formatMoney(num(rate))}/год`
  const reviewRow = (k: string, v: string) => (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' }}
    >
      <span style={{ color: 'var(--wf-fg-muted)' }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title="Новий фін-проєкт"
      aux={`крок ${step + 1}/${WIZARD_STEPS.length} · ${WIZARD_STEPS[step]}`}
      size="lg"
      footer={
        <>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={save.isPending}>
              Назад
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Скасувати
          </Button>
          {last ? (
            <Button variant="primary" loading={save.isPending} onClick={submit}>
              Створити
            </Button>
          ) : (
            <Button variant="primary" disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
              Далі
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {WIZARD_STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= step ? 'var(--wf-accent)' : 'var(--wf-border)',
            }}
          />
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Select
            label="Клієнт"
            value={companyId}
            onChange={setCompanyId}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input
            label="Назва проєкту"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={name !== '' && name.trim().length < 2 ? 'Мінімум 2 символи' : undefined}
          />
          <Input
            label="Тип (опц., напр. «Підтримка»)"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Select
            label="Модель білінгу"
            value={model}
            onChange={(v) => setModel(v as FinProject['billingModel'])}
            options={Object.entries(MODEL_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {isFixed ? (
              <Input
                label="Абонплата / міс"
                type="number"
                value={abon}
                onChange={(e) => setAbon(e.target.value)}
                error={abon !== '' && !(Number(abon) > 0) ? '> 0' : undefined}
              />
            ) : (
              <Input
                label="Ставка / год"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                error={rate !== '' && !(Number(rate) > 0) ? '> 0' : undefined}
              />
            )}
            <Select
              label="Валюта"
              value={currency}
              onChange={setCurrency}
              options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select
              label="Цикл"
              value={cycle}
              onChange={(v) => setCycle(v as FinProject['billingCycle'])}
              options={Object.entries(CYCLE_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Input
              label="Строк оплати, днів (опц.)"
              type="number"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select
              label="Погодження вартості"
              value={mode}
              onChange={(v) => setMode(v as '' | NonNullable<FinProject['approvalMode']>)}
              options={[
                { value: '', label: 'Успадкувати (за замовч.)' },
                ...Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label })),
              ]}
            />
            {mode === 'on_actuals' && (
              <Select
                label="Хто погоджує рахунок"
                value={approver}
                onChange={(v) => setApprover(v as NonNullable<FinProject['invoiceApprover']>)}
                options={Object.entries(APPROVER_LABEL).map(([value, label]) => ({ value, label }))}
              />
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {reviewRow('Клієнт', companies.find((c) => c.id === companyId)?.name ?? '—')}
          {reviewRow('Назва', name.trim() || '—')}
          {type.trim() && reviewRow('Тип', type.trim())}
          {reviewRow('Модель', MODEL_LABEL[model] ?? model)}
          {reviewRow('Вартість', `${money} ${currency}`)}
          {reviewRow('Цикл', CYCLE_LABEL[cycle] ?? cycle)}
          {terms.trim() && reviewRow('Строк оплати', `${terms} дн.`)}
          {reviewRow('Погодження', mode === '' ? 'Успадкувати' : (MODE_LABEL[mode] ?? mode))}
          {mode === 'on_actuals' && reviewRow('Погоджує', APPROVER_LABEL[approver] ?? approver)}
        </div>
      )}

      {save.isError && (
        <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 12 }}>
          Не вдалося створити — перевірте поля.
        </div>
      )}
    </Modal>
  )
}

export function ProjectsPage() {
  const projects = useProjects()
  const companies = useCompanies()
  const [editing, setEditing] = useState<FinProject | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const companyName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companies.data?.companies ?? []) m.set(c.id, c.name)
    return (id: string) => m.get(id) ?? id.slice(0, 8)
  }, [companies.data])

  if (projects.isLoading) return <Skeleton variant="title" />
  if (projects.isError) {
    return (
      <EmptyState
        title="Не вдалося завантажити проєкти"
        action={<Button onClick={() => void projects.refetch()}>Оновити</Button>}
      />
    )
  }
  const list = projects.data?.projects ?? []
  const activeCount = list.filter((p) => p.active).length
  const filtered =
    filter === 'all' ? list : list.filter((p) => (filter === 'active' ? p.active : !p.active))

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Фін-проєкти</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // {activeCount} активних / {list.length} всього · модель, цикл, погодження per-проєкт
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreating(true)}
          disabled={(companies.data?.companies.length ?? 0) === 0}
        >
          Новий проєкт
        </Button>
      </div>

      {list.length > 0 && (
        <Tabs
          items={[
            { id: 'all', label: `Усі (${list.length})` },
            { id: 'active', label: `Активні (${activeCount})` },
            { id: 'inactive', label: `Неактивні (${list.length - activeCount})` },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as typeof filter)}
        />
      )}

      <div style={{ marginTop: 16 }}>
        {list.length === 0 ? (
          <EmptyState
            title="Проєктів ще немає"
            description="Створіть фін-проєкт клієнта, щоб запустити білінг."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Немає проєктів у цьому фільтрі"
            description="Змініть фільтр статусу."
          />
        ) : (
          <Card>
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditing(p)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--wf-border)',
                  background: 'none',
                  border: 'none',
                  borderBottomColor: 'var(--wf-border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {p.name}{' '}
                    <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                      · {companyName(p.companyId)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--wf-fg-secondary)',
                      marginTop: 3,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span>{MODEL_LABEL[p.billingModel]}</span>·
                    <span>{CYCLE_LABEL[p.billingCycle]}</span>
                    {p.approvalMode && p.approvalMode !== 'none' && (
                      <>
                        ·
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <StatusDot tone="warning" /> {MODE_LABEL[p.approvalMode]}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: 600, flexShrink: 0 }}>
                  {p.billingModel === 'fixed_monthly_advance'
                    ? `${formatMoney(num(p.abonAmount))}/міс`
                    : `${formatMoney(num(p.clientHourlyRate))}/год`}{' '}
                  {p.currency}
                </div>
              </button>
            ))}
          </Card>
        )}
      </div>

      {creating && (
        <ProjectWizard
          companies={companies.data?.companies ?? []}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <ProjectModal
          project={editing}
          companies={companies.data?.companies ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
