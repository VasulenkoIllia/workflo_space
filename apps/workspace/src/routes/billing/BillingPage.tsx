import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { Select } from '@/components/Select'
import { formatDate, formatMoney } from '@/lib/format'
import {
  num,
  useApplyDiscount,
  useBillingOverview,
  useCreatePayment,
  useReleaseCharge,
  useWsCharges,
  useWsPayments,
  type WsCharge,
} from '@/lib/billing'
import { useCompanies } from '@/lib/projects'

const KIND_LABEL: Record<string, string> = {
  subscription: 'Абонплата',
  hourly: 'Погодинно',
  overage: 'Понад ліміт',
  prepaid_advance: 'Аванс',
  prepaid_reconciliation: 'Звірка',
  prepaid_credit: 'Кредит',
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

function ApprovalBadge({ status }: { status: WsCharge['approvalStatus'] }) {
  if (status == null) return null
  const meta = {
    pending: { tone: 'warning' as const, label: 'чернетка — на погодженні' },
    approved: { tone: 'success' as const, label: 'випущено' },
    rejected: { tone: 'muted' as const, label: 'відхилено' },
  }[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
      <StatusDot tone={meta.tone} /> {meta.label}
    </span>
  )
}

function ChargeRow({
  c,
  onRelease,
  onDiscount,
}: {
  c: WsCharge
  onRelease: (c: WsCharge) => void
  onDiscount: (c: WsCharge) => void
}) {
  const quote = num(c.amount)
  const final = num(c.totalAmount)
  const discounted = c.approvedAmount != null && final != null && quote != null && final < quote
  return (
    <div
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
          {KIND_LABEL[c.kind ?? ''] ?? c.kind ?? 'Нарахування'}{' '}
          <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            {c.month}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)', marginTop: 3 }}>
          <ApprovalBadge status={c.approvalStatus} />
          {c.approvalStatus == null && (
            <span>
              {c.status === 'paid'
                ? 'Сплачено'
                : c.status === 'overdue'
                  ? 'Прострочено'
                  : 'До сплати'}
              {c.dueDate ? ` · до ${formatDate(c.dueDate)}` : ''}
            </span>
          )}
          {c.approvalComment ? (
            <span style={{ color: 'var(--wf-fg-muted)' }}> · «{c.approvalComment}»</span>
          ) : null}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 600 }}>
          {discounted && (
            <span
              style={{
                color: 'var(--wf-fg-muted)',
                textDecoration: 'line-through',
                marginRight: 6,
              }}
            >
              {formatMoney(quote)}
            </span>
          )}
          {formatMoney(final ?? quote)} {c.currency}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
          {c.status !== 'paid' && (
            <Button size="sm" variant="ghost" onClick={() => onDiscount(c)}>
              Знижка
            </Button>
          )}
          {c.approvalStatus === 'pending' && (
            <Button size="sm" variant="primary" onClick={() => onRelease(c)}>
              Випустити
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Release (approve) / refuse a draft charge — internal channel, with optional counter-offer. */
function ReleaseModal({ charge, onClose }: { charge: WsCharge; onClose: () => void }) {
  const release = useReleaseCharge()
  const billed = num(charge.totalAmount) ?? num(charge.amount) ?? 0
  const [counter, setCounter] = useState('')
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject'>('approve')

  const counterNum = counter.trim() === '' ? undefined : Number(counter)
  const counterInvalid =
    counterNum != null && (!Number.isFinite(counterNum) || counterNum <= 0 || counterNum > billed)

  const submit = () => {
    if (mode === 'reject' && comment.trim() === '') return
    if (mode === 'approve' && counterInvalid) return
    release.mutate(
      {
        id: charge.id,
        decision: mode,
        comment: comment.trim() || undefined,
        approvedAmount: mode === 'approve' ? counterNum : undefined,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Випуск рахунку"
      aux={`${charge.month} · ${formatMoney(billed)} ${charge.currency}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={release.isPending}>
            Скасувати
          </Button>
          <Button
            variant={mode === 'reject' ? 'danger' : 'primary'}
            loading={release.isPending}
            onClick={submit}
          >
            {mode === 'approve' ? 'Випустити' : 'Відхилити'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Button
          variant={mode === 'approve' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('approve')}
        >
          Випустити
        </Button>
        <Button
          variant={mode === 'reject' ? 'danger' : 'secondary'}
          size="sm"
          onClick={() => setMode('reject')}
        >
          Відхилити
        </Button>
      </div>
      {mode === 'approve' ? (
        <Input
          label={`Виставити меншу суму? (необов'язково, ≤ ${formatMoney(billed)})`}
          type="number"
          placeholder={String(billed)}
          value={counter}
          onChange={(e) => setCounter(e.target.value)}
          error={counterInvalid ? 'Сума має бути > 0 і не більше виставленої' : undefined}
        />
      ) : (
        <Input
          label="Причина відхилення"
          placeholder="Чому відхиляємо цю чернетку"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          error={comment.trim() === '' ? 'Вкажіть причину' : undefined}
        />
      )}
      {release.isError && (
        <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 10 }}>
          Не вдалося — можливо, цей рахунок погоджує клієнт, не команда.
        </div>
      )}
    </Modal>
  )
}

const PAY_TYPE: Record<string, string> = {
  advance: 'Аванс',
  final: 'Фінальний',
  invoice_payment: 'Оплата рахунку',
  manual: 'Вручну',
  prepaid: 'Передоплата',
}

/** Owner applies a one-time manual discount (% and/or flat) on top of loyalty (P-10, 05-З). */
function DiscountModal({ charge, onClose }: { charge: WsCharge; onClose: () => void }) {
  const apply = useApplyDiscount()
  const base = num(charge.baseAmount) ?? num(charge.amount) ?? 0
  const [pct, setPct] = useState(charge.manualDiscountPct ?? '')
  const [amount, setAmount] = useState(charge.manualDiscountAmount ?? '')
  const [reason, setReason] = useState('')

  const pctNum = pct.trim() === '' ? undefined : Number(pct)
  const amountNum = amount.trim() === '' ? undefined : Number(amount)
  const pctInvalid = pctNum != null && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100)
  const amountInvalid =
    amountNum != null && (!Number.isFinite(amountNum) || amountNum < 0 || amountNum > base)
  const nothing = pctNum == null && amountNum == null
  const canSubmit = !nothing && !pctInvalid && !amountInvalid

  const submit = () => {
    if (!canSubmit) return
    apply.mutate(
      {
        id: charge.id,
        discountPct: pctNum,
        discountAmount: amountNum,
        reason: reason.trim() || undefined,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Разова знижка"
      aux={`${charge.month} · база ${formatMoney(base)} ${charge.currency}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={apply.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={apply.isPending}
            disabled={!canSubmit}
            onClick={submit}
          >
            Застосувати
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          // знижка поверх лояльності; вкажіть % та/або суму (0 — щоб прибрати)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Відсоток, %"
            type="number"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            error={pctInvalid ? '0–100' : undefined}
          />
          <Input
            label="Сума знижки"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountInvalid ? `0–${formatMoney(base)}` : undefined}
          />
        </div>
        <Input
          label="Причина (необов'язково)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {nothing && (
          <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            Вкажіть відсоток та/або суму.
          </div>
        )}
        {apply.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
            Не вдалося застосувати знижку — лише власник, і рахунок ще не оплачено.
          </div>
        )}
      </div>
    </Modal>
  )
}

const CREATE_TYPE: { value: 'advance' | 'final' | 'partial'; label: string }[] = [
  { value: 'final', label: 'Фінальний' },
  { value: 'advance', label: 'Аванс' },
  { value: 'partial', label: 'Частковий' },
]

/** Operator records a confirmed manual payment for a client company (idempotent server-side). */
function CreatePaymentModal({ onClose }: { onClose: () => void }) {
  const create = useCreatePayment()
  const companies = useCompanies()
  const list = companies.data?.companies ?? []
  const companyOptions = useMemo(() => list.map((c) => ({ value: c.id, label: c.name })), [list])
  const [companyId, setCompanyId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [type, setType] = useState<'advance' | 'final' | 'partial'>('final')
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')

  const amountNum = Number(amount)
  const amountInvalid = !(amountNum > 0)
  const canSubmit = companyId !== '' && !amountInvalid

  const pickCompany = (id: string) => {
    setCompanyId(id)
    const c = list.find((x) => x.id === id)
    if (c) setCurrency(c.currency) // default to the company's billing currency
  }

  const submit = () => {
    if (!canSubmit) return
    create.mutate(
      {
        companyId,
        amount: amountNum,
        currency,
        type,
        paymentMethod: method.trim() || undefined,
        note: note.trim() || undefined,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Підтвердити оплату"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!canSubmit}
            onClick={submit}
          >
            Підтвердити
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Select
          label="Клієнт (платник)"
          value={companyId}
          onChange={pickCompany}
          options={
            companies.isLoading
              ? [{ value: '', label: 'Завантаження…' }]
              : [{ value: '', label: '— оберіть компанію —' }, ...companyOptions]
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Сума"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount !== '' && amountInvalid ? '> 0' : undefined}
          />
          <Select
            label="Валюта"
            value={currency}
            onChange={setCurrency}
            options={['USD', 'UAH', 'EUR'].map((c) => ({ value: c, label: c }))}
          />
        </div>
        <Select
          label="Тип платежу"
          value={type}
          onChange={(v) => setType(v as 'advance' | 'final' | 'partial')}
          options={CREATE_TYPE}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Спосіб (необов'язково)"
            placeholder="банк, карта, готівка…"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
          <Input
            label="Примітка (необов'язково)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {create.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
            Не вдалося підтвердити платіж — перевірте поля та права доступу.
          </div>
        )}
      </div>
    </Modal>
  )
}

export function BillingPage() {
  const overview = useBillingOverview()
  const [hub, setHub] = useState<'charges' | 'payments' | 'debtors'>('charges')
  const [chargeFilter, setChargeFilter] = useState<'pending' | 'all'>('pending')
  const charges = useWsCharges(chargeFilter === 'pending' ? 'pending' : undefined)
  const payments = useWsPayments()
  const [releasing, setReleasing] = useState<WsCharge | null>(null)
  const [discounting, setDiscounting] = useState<WsCharge | null>(null)
  const [paying, setPaying] = useState(false)

  // The pending count drives the queue badge — always query it.
  const pending = useWsCharges('pending')
  const pendingCount = pending.data?.charges.length ?? 0

  if (overview.isLoading) {
    return (
      <div>
        <Skeleton variant="title" />
        <div style={{ marginTop: 16 }}>
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    )
  }
  if (overview.isError || !overview.data) {
    return (
      <EmptyState
        title="Не вдалося завантажити фінанси"
        description="Спробуйте оновити сторінку."
        action={<Button onClick={() => void overview.refetch()}>Оновити</Button>}
      />
    )
  }

  const o = overview.data
  const list = charges.data?.charges ?? []
  const paymentList = payments.data?.payments ?? []

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
          <div style={{ fontSize: 28, fontWeight: 600 }}>Білінг</div>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
          >
            // рахунки, платежі, погодження та борг
          </div>
        </div>
        <Button variant="primary" onClick={() => setPaying(true)}>
          + Підтвердити оплату
        </Button>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <Stat k="дохід / місяць" v={formatMoney(num(o.monthlyRevenueUsd))} tone="accent" />
        <Stat k="дохід усього" v={formatMoney(num(o.totalRevenueUsd))} />
        <Stat
          k="борг клієнтів"
          v={formatMoney(num(o.outstandingDebt))}
          tone={num(o.outstandingDebt) ? 'warn' : undefined}
        />
        <Stat k="на погодженні" v={String(pendingCount)} tone={pendingCount ? 'warn' : undefined} />
      </div>

      <Tabs
        items={[
          { id: 'charges', label: `Рахунки${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { id: 'payments', label: 'Платежі' },
          {
            id: 'debtors',
            label: `Дебітори${o.topDebtors.length ? ` (${o.topDebtors.length})` : ''}`,
          },
        ]}
        value={hub}
        onChange={(id) => setHub(id as typeof hub)}
      />

      <div style={{ marginTop: 16 }}>
        {hub === 'charges' && (
          <>
            <div className="wfp-od-tabs" role="tablist" style={{ marginBottom: 4 }}>
              <button
                type="button"
                role="tab"
                aria-selected={chargeFilter === 'pending'}
                onClick={() => setChargeFilter('pending')}
              >
                На погодженні{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={chargeFilter === 'all'}
                onClick={() => setChargeFilter('all')}
              >
                Всі рахунки
              </button>
            </div>
            {charges.isLoading ? (
              <Skeleton />
            ) : list.length === 0 ? (
              <EmptyState
                title={
                  chargeFilter === 'pending' ? 'Немає чернеток на погодженні' : 'Рахунків ще немає'
                }
                description={
                  chargeFilter === 'pending'
                    ? 'on_actuals-нарахування зʼявляться тут для випуску.'
                    : 'Нарахування проєктів зʼявляться тут.'
                }
              />
            ) : (
              <Card>
                {list.map((c) => (
                  <ChargeRow
                    key={c.id}
                    c={c}
                    onRelease={setReleasing}
                    onDiscount={setDiscounting}
                  />
                ))}
              </Card>
            )}
          </>
        )}

        {hub === 'payments' &&
          (payments.isLoading ? (
            <Skeleton />
          ) : paymentList.length === 0 ? (
            <EmptyState
              title="Платежів ще немає"
              description="Підтверджені платежі зʼявляться тут."
            />
          ) : (
            <Card>
              {paymentList.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--wf-border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {formatMoney(num(p.amount))} {p.currency}
                      {p.amountUsd && p.currency !== 'USD' ? (
                        <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                          {' '}
                          (≈ {formatMoney(num(p.amountUsd))})
                        </span>
                      ) : null}
                    </div>
                    <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                      {PAY_TYPE[p.type] ?? p.type}
                      {p.paymentMethod ? ` · ${p.paymentMethod}` : ''} · {formatDate(p.confirmedAt)}
                    </div>
                  </div>
                  <StatusDot tone="success" />
                </div>
              ))}
            </Card>
          ))}

        {hub === 'debtors' &&
          (o.topDebtors.length === 0 ? (
            <EmptyState
              title="Боргів немає 🎉"
              description="Коли в клієнтів зʼявиться борг, він буде тут."
            />
          ) : (
            <Card>
              {o.topDebtors.map((d) => (
                <div
                  key={d.companyId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--wf-border)',
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {d.name}
                  </span>
                  <span style={{ color: 'var(--wf-warning)', fontWeight: 600 }}>
                    {formatMoney(num(d.debt))}
                  </span>
                </div>
              ))}
            </Card>
          ))}
      </div>

      {releasing && <ReleaseModal charge={releasing} onClose={() => setReleasing(null)} />}
      {discounting && <DiscountModal charge={discounting} onClose={() => setDiscounting(null)} />}
      {paying && <CreatePaymentModal onClose={() => setPaying(false)} />}
    </div>
  )
}
