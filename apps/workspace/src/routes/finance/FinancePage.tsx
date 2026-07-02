import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, Tabs } from '@workflo/ui'
import { Donut, type DonutSegment } from '@/components/Donut'
import { ExportButtons } from '@/components/ExportButtons'
import { LineChart } from '@/components/LineChart'
import { Select } from '@/components/Select'
import { type ExportTable } from '@/lib/exportTable'
import { catColor, catLabel, EXPENSE_CAT } from '@/lib/expenseCategories'
import { formatDate, formatMoney } from '@/lib/format'
import { useTeam } from '@/lib/payouts'
import {
  isoDay,
  num,
  useArchiveExpense,
  useExpenses,
  useMonthlyPnl,
  usePnl,
  useSaveExpense,
  type Expense,
  type ExpenseCategory,
  type ExpenseFrequency,
  type ExpenseInput,
  type ExpenseType,
} from '@/lib/finance'

const TYPE_LABEL: Record<ExpenseType, string> = { recurring: 'Регулярна', one_time: 'Разова' }
const FREQ_LABEL: Record<string, string> = {
  monthly: 'Щомісяця',
  quarterly: 'Щокварталу',
  annual: 'Щороку',
  one_time: 'Одноразово',
}
/** Normalize a recurring expense to its monthly-equivalent (run-rate / MRR). */
const MONTHLY_FACTOR: Record<string, number> = {
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
  one_time: 0,
}
function monthlyEq(amount: number, frequency: string | null): number {
  return amount * (MONTHLY_FACTOR[frequency ?? 'one_time'] ?? 0)
}
const MONTH_ABBR = [
  'січ',
  'лют',
  'бер',
  'кві',
  'тра',
  'чер',
  'лип',
  'сер',
  'вер',
  'жов',
  'лис',
  'гру',
]
function monthLabel(ym: string): string {
  const m = Number(ym.split('-')[1])
  return MONTH_ABBR[m - 1] ?? ym
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'accent' | 'warn' }) {
  const color =
    tone === 'warn' ? 'var(--wf-warning)' : tone === 'accent' ? 'var(--wf-accent)' : 'var(--wf-fg)'
  return (
    <div className="wfp-stat">
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{v}</div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
    </div>
  )
}

const dateField = (label: string, value: string, onChange: (v: string) => void) => (
  <label style={{ display: 'grid', gap: 4 }}>
    <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
      {label}
    </span>
    <input
      type="date"
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
    />
  </label>
)

function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const save = useSaveExpense()
  const editing = expense != null
  const [type, setType] = useState<ExpenseType>(expense?.type ?? 'recurring')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'software')
  const [vendor, setVendor] = useState(expense?.vendor ?? '')
  const [amount, setAmount] = useState(expense?.amount ?? '')
  const [currency, setCurrency] = useState(expense?.currency ?? 'USD')
  const [frequency, setFrequency] = useState(expense?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(expense?.startDate ?? isoDay(new Date()))
  const [endDate, setEndDate] = useState(expense?.endDate ?? '')

  const amountInvalid = !(Number(amount) > 0)

  const submit = () => {
    if (amountInvalid) return
    const body: ExpenseInput & { id?: string } = {
      id: expense?.id,
      category,
      vendor: vendor.trim() || null,
      amount: Number(amount),
      currency,
      frequency: type === 'recurring' ? (frequency as ExpenseInput['frequency']) : 'one_time',
      startDate,
      endDate: endDate || null,
      ...(editing ? {} : { type }),
    }
    save.mutate(body, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Редагувати витрату' : 'Нова витрата'}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {!editing && (
            <Select
              label="Тип"
              value={type}
              onChange={(v) => setType(v as ExpenseType)}
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          )}
          <Select
            label="Категорія"
            value={category}
            onChange={(v) => setCategory(v as ExpenseCategory)}
            options={Object.entries(EXPENSE_CAT).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
          />
        </div>
        <Input label="Постачальник" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Сума"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountInvalid ? '> 0' : undefined}
          />
          <Select
            label="Валюта"
            value={currency}
            onChange={setCurrency}
            options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
          />
        </div>
        {type === 'recurring' && (
          <Select
            label="Періодичність"
            value={frequency ?? 'monthly'}
            onChange={(v) => setFrequency(v as ExpenseFrequency)}
            options={['monthly', 'quarterly', 'annual'].map((f) => ({
              value: f,
              label: FREQ_LABEL[f] ?? f,
            }))}
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {dateField('ПОЧАТОК', startDate, setStartDate)}
          {dateField('КІНЕЦЬ (опц.)', endDate, setEndDate)}
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

export function FinancePage() {
  const [tab, setTab] = useState<'overview' | 'expenses' | 'pnl'>('overview')
  const monthStart = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])
  const today = useMemo(() => isoDay(new Date()), [])
  const [period, setPeriod] = useState<3 | 6 | 12>(6)
  const [expType, setExpType] = useState<'all' | ExpenseType>('all')
  const [expCat, setExpCat] = useState<'all' | ExpenseCategory>('all')
  const pnl = usePnl(monthStart, today)
  const monthly = useMonthlyPnl(period)
  const expenses = useExpenses()
  const archive = useArchiveExpense()
  const team = useTeam()
  const execName = (id: string) =>
    team.data?.members.find((m) => m.profileId === id)?.name ?? id.slice(0, 8)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [creating, setCreating] = useState(false)

  const activeExpenses = useMemo(
    () => (expenses.data?.expenses ?? []).filter((e) => e.isActive),
    [expenses.data]
  )
  const filteredExpenses = useMemo(
    () =>
      activeExpenses.filter(
        (e) =>
          (expType === 'all' || e.type === expType) && (expCat === 'all' || e.category === expCat)
      ),
    [activeExpenses, expType, expCat]
  )

  const periodLabel = period === 12 ? '12 міс' : `${period} міс`
  const pnlTable = (): ExportTable => ({
    sheet: 'P&L',
    headers: ['Місяць', 'Дохід', 'Витрати', 'Зарплата', 'Чистий', 'Маржа%'],
    rows: monthly.points.map((pt) => {
      const d = pt.data
      return [
        pt.month,
        num(d?.revenueUsd) ?? 0,
        num(d?.expensesUsd) ?? 0,
        num(d?.salaryUsd) ?? 0,
        num(d?.netProfitUsd) ?? 0,
        d?.marginPct != null ? Number(d.marginPct) : null,
      ]
    }),
  })
  const periodSeg = (
    <div className="wfp-od-tabs" role="tablist">
      {([3, 6, 12] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={period === m}
          onClick={() => setPeriod(m)}
        >
          {m === 12 ? 'рік' : `${m}м`}
        </button>
      ))}
    </div>
  )

  const p = pnl.data
  const donutSegs: DonutSegment[] = (p?.byCategory ?? [])
    .map((c) => ({
      label: catLabel(c.category),
      value: num(c.amountUsd) ?? 0,
      color: catColor(c.category),
    }))
    .filter((s) => s.value > 0)
  const totalExp = donutSegs.reduce((s, x) => s + x.value, 0)

  const labels = monthly.points.map((pt) => monthLabel(pt.month))
  // Series colors per design-v2 (workspace-finance.jsx): revenue=success, expenses=destructive, net=accent.
  const series = [
    {
      label: 'дохід',
      color: 'var(--wf-success)',
      values: monthly.points.map((pt) => num(pt.data?.revenueUsd) ?? 0),
    },
    {
      label: 'витрати',
      color: 'var(--wf-destructive)',
      values: monthly.points.map((pt) => num(pt.data?.expensesUsd) ?? 0),
    },
    {
      label: 'чистий',
      color: 'var(--wf-accent)',
      values: monthly.points.map((pt) => num(pt.data?.netProfitUsd) ?? 0),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Фінанси</div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 16 }}
          >
            // P&L, витрати та тренд агенції
          </div>
        </div>
        <ExportButtons
          getTables={pnlTable}
          filename={`pnl-${period}m`}
          disabled={monthly.points.length === 0}
        />
      </div>

      <Tabs
        items={[
          { id: 'overview', label: 'Огляд' },
          { id: 'expenses', label: 'Витрати' },
          { id: 'pnl', label: `P&L · ${periodLabel}` },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'overview' && (
        <div style={{ marginTop: 16 }}>
          {pnl.isLoading ? (
            <Skeleton style={{ height: 90 }} />
          ) : (
            <div className="wfp-stats" style={{ marginBottom: 18 }}>
              <Stat k="дохід / місяць" v={formatMoney(num(p?.revenueUsd))} tone="accent" />
              <Stat k="витрати / місяць" v={formatMoney(num(p?.expensesUsd))} />
              <Stat k="зарплата" v={formatMoney(num(p?.salaryUsd))} />
              <Stat
                k={`чистий · ${p?.marginPct ?? '—'}%`}
                v={formatMoney(num(p?.netProfitUsd))}
                tone={(num(p?.netProfitUsd) ?? 0) < 0 ? 'warn' : 'accent'}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
            <Card title="Витрати за категоріями · цей місяць">
              {donutSegs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
                  Витрат цього місяця немає.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                  <Donut
                    data={donutSegs}
                    centerValue={formatMoney(totalExp)}
                    centerLabel="витрати"
                  />
                  <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                    {donutSegs.map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{ width: 9, height: 9, borderRadius: 2, background: s.color }}
                          />
                          {s.label}
                        </span>
                        <span style={{ color: 'var(--wf-fg-muted)' }}>{formatMoney(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card title={`Тренд · ${periodLabel}`} actions={periodSeg}>
              {monthly.isLoading ? (
                <Skeleton style={{ height: 170 }} />
              ) : (
                <LineChart series={series} labels={labels} />
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              // регулярні й разові витрати
            </div>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              Нова витрата
            </Button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <div className="wfp-od-tabs" role="tablist">
              {(
                [
                  ['all', 'Усі'],
                  ['recurring', 'Регулярні'],
                  ['one_time', 'Разові'],
                ] as const
              ).map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={expType === id}
                  onClick={() => setExpType(id)}
                >
                  {l}
                </button>
              ))}
            </div>
            <select
              value={expCat}
              onChange={(e) => setExpCat(e.target.value as 'all' | ExpenseCategory)}
              style={{
                background: 'var(--wf-surface)',
                color: 'var(--wf-fg)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: '6px 10px',
                fontSize: 13,
              }}
            >
              <option value="all">Усі категорії</option>
              {Object.entries(EXPENSE_CAT).map(([v, m]) => (
                <option key={v} value={v}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {expenses.isLoading ? (
            <Skeleton />
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              title={activeExpenses.length === 0 ? 'Витрат ще немає' : 'Нічого за фільтром'}
              description={
                activeExpenses.length === 0
                  ? 'Додайте регулярні й разові витрати агенції.'
                  : 'Спробуйте інший тип або категорію.'
              }
            />
          ) : (
            <Card>
              {filteredExpenses.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid var(--wf-border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {e.vendor || catLabel(e.category)}{' '}
                      <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                        · {catLabel(e.category)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
                      {TYPE_LABEL[e.type]}
                      {e.frequency && e.type === 'recurring'
                        ? ` · ${FREQ_LABEL[e.frequency]}`
                        : ''}{' '}
                      · з {formatDate(e.startDate)}
                      {e.endDate ? ` до ${formatDate(e.endDate)}` : ''}
                      {e.executorId ? ` · 👤 ${execName(e.executorId)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {e.type === 'recurring' && e.frequency && e.frequency !== 'one_time' && (
                      <div
                        className="wfp-mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--wf-fg-muted)',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                        title="Місячний еквівалент (run-rate)"
                      >
                        {formatMoney(monthlyEq(num(e.amount) ?? 0, e.frequency))} {e.currency}/міс
                      </div>
                    )}
                    <div style={{ fontWeight: 600 }}>
                      {formatMoney(num(e.amount))} {e.currency}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                      Змінити
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={archive.isPending}
                      onClick={() => archive.mutate(e.id)}
                    >
                      В архів
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {tab === 'pnl' && (
        <div style={{ marginTop: 16 }}>
          {monthly.isLoading ? (
            <Skeleton style={{ height: 200 }} />
          ) : (
            <Card>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr repeat(5, minmax(72px, 1fr))',
                  gap: 8,
                  fontSize: 11,
                  color: 'var(--wf-fg-muted)',
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--wf-border)',
                }}
                className="wfp-mono"
              >
                <span>МІСЯЦЬ</span>
                <span style={{ textAlign: 'right' }}>ДОХІД</span>
                <span style={{ textAlign: 'right' }}>ВИТРАТИ</span>
                <span style={{ textAlign: 'right' }}>ЗП</span>
                <span style={{ textAlign: 'right' }}>ЧИСТИЙ</span>
                <span style={{ textAlign: 'right' }}>МАРЖА</span>
              </div>
              {monthly.points.map((pt) => {
                const d = pt.data
                const net = num(d?.netProfitUsd) ?? 0
                return (
                  <div
                    key={pt.month}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr repeat(5, minmax(72px, 1fr))',
                      gap: 8,
                      fontSize: 13,
                      padding: '10px 0',
                      borderBottom: '1px solid var(--wf-border)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{pt.month}</span>
                    <span style={{ textAlign: 'right' }}>{formatMoney(num(d?.revenueUsd))}</span>
                    <span style={{ textAlign: 'right' }}>{formatMoney(num(d?.expensesUsd))}</span>
                    <span style={{ textAlign: 'right' }}>{formatMoney(num(d?.salaryUsd))}</span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: net < 0 ? 'var(--wf-warning)' : 'var(--wf-accent)',
                      }}
                    >
                      {formatMoney(num(d?.netProfitUsd))}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--wf-fg-muted)' }}>
                      {d?.marginPct ?? '—'}%
                    </span>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      )}

      {(creating || editing) && (
        <ExpenseModal
          expense={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
