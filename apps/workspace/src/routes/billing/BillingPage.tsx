import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { formatDate, formatMoney } from '@/lib/format'
import {
  num,
  useBillingOverview,
  useReleaseCharge,
  useWsCharges,
  useWsPayments,
  type WsCharge,
} from '@/lib/billing'

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

function ChargeRow({ c, onRelease }: { c: WsCharge; onRelease: (c: WsCharge) => void }) {
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
        {c.approvalStatus === 'pending' && (
          <Button size="sm" variant="primary" onClick={() => onRelease(c)} style={{ marginTop: 6 }}>
            Випустити
          </Button>
        )}
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

export function BillingPage() {
  const overview = useBillingOverview()
  const [hub, setHub] = useState<'charges' | 'payments' | 'debtors'>('charges')
  const [chargeFilter, setChargeFilter] = useState<'pending' | 'all'>('pending')
  const charges = useWsCharges(chargeFilter === 'pending' ? 'pending' : undefined)
  const payments = useWsPayments()
  const [releasing, setReleasing] = useState<WsCharge | null>(null)

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
      <div style={{ fontSize: 28, fontWeight: 600 }}>Фінанси</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // рахунки, платежі, погодження та борг
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
                  <ChargeRow key={c.id} c={c} onRelease={setReleasing} />
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
    </div>
  )
}
