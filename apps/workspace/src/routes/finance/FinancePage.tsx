import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import { formatDate, formatMoney } from '@/lib/format'
import {
  isoDay,
  num,
  useArchiveExpense,
  useExpenses,
  usePnl,
  useSaveExpense,
  type Expense,
  type ExpenseCategory,
  type ExpenseFrequency,
  type ExpenseInput,
  type ExpenseType,
} from '@/lib/finance'

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  infrastructure: 'Інфраструктура',
  software: 'ПЗ / підписки',
  salary: 'Зарплата',
  contractor: 'Підрядники',
  rent: 'Оренда',
  tax: 'Податки',
  marketing: 'Маркетинг',
  other: 'Інше',
}
const TYPE_LABEL: Record<ExpenseType, string> = { recurring: 'Регулярна', one_time: 'Разова' }
const FREQ_LABEL: Record<string, string> = {
  monthly: 'Щомісяця',
  quarterly: 'Щокварталу',
  annual: 'Щороку',
  one_time: 'Одноразово',
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
            options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
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
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ПОЧАТОК
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              КІНЕЦЬ (опц.)
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
  const [range] = useState(() => {
    const now = new Date()
    return { from: `${now.getFullYear()}-01-01`, to: isoDay(now) }
  })
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const pnl = usePnl(from, to)
  const expenses = useExpenses()
  const archive = useArchiveExpense()
  const [editing, setEditing] = useState<Expense | null>(null)
  const [creating, setCreating] = useState(false)

  const activeExpenses = useMemo(
    () => (expenses.data?.expenses ?? []).filter((e) => e.isActive),
    [expenses.data]
  )

  const dateInput = (value: string, onChange: (v: string) => void) => (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--wf-surface)',
        color: 'var(--wf-fg)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        padding: '6px 8px',
        fontSize: 13,
      }}
    />
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Фінанси</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // P&L і витрати агенції
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dateInput(from, setFrom)}
          <span style={{ color: 'var(--wf-fg-muted)' }}>—</span>
          {dateInput(to, setTo)}
        </div>
      </div>

      {pnl.isLoading ? (
        <Skeleton style={{ height: 90 }} />
      ) : pnl.isError || !pnl.data ? (
        <EmptyState title="Не вдалося порахувати P&L" description="Перевірте діапазон дат." />
      ) : (
        <>
          <div className="wfp-stats" style={{ marginBottom: 10 }}>
            <Stat k="дохід" v={formatMoney(num(pnl.data.revenueUsd))} tone="accent" />
            <Stat k="витрати" v={formatMoney(num(pnl.data.expensesUsd))} />
            <Stat k="зарплата" v={formatMoney(num(pnl.data.salaryUsd))} />
            <Stat
              k={`чистий · ${pnl.data.marginPct}%`}
              v={formatMoney(num(pnl.data.netProfitUsd))}
              tone={(num(pnl.data.netProfitUsd) ?? 0) < 0 ? 'warn' : 'accent'}
            />
          </div>
          {pnl.data.byCategory.length > 0 && (
            <div
              className="wfp-mono"
              style={{
                fontSize: 11,
                color: 'var(--wf-fg-muted)',
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
                marginBottom: 22,
              }}
            >
              {pnl.data.byCategory.map((c) => (
                <span key={c.category}>
                  {CATEGORY_LABEL[c.category as ExpenseCategory] ?? c.category}:{' '}
                  {formatMoney(num(c.amountUsd))}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Витрати</div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          Нова витрата
        </Button>
      </div>

      {expenses.isLoading ? (
        <Skeleton />
      ) : activeExpenses.length === 0 ? (
        <EmptyState
          title="Витрат ще немає"
          description="Додайте регулярні й разові витрати агенції."
        />
      ) : (
        <Card>
          {activeExpenses.map((e) => (
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
                  {e.vendor || CATEGORY_LABEL[e.category]}{' '}
                  <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                    · {CATEGORY_LABEL[e.category]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
                  {TYPE_LABEL[e.type]}
                  {e.frequency && e.type === 'recurring' ? ` · ${FREQ_LABEL[e.frequency]}` : ''} · з{' '}
                  {formatDate(e.startDate)}
                  {e.endDate ? ` до ${formatDate(e.endDate)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
