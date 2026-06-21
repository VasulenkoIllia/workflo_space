import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot } from '@workflo/ui'
import { formatDate, formatMoney } from '@/lib/format'
import {
  num,
  type PortalCharge,
  useDecideCharge,
  usePortalCharges,
  usePortalPayments,
  usePortalSummary,
} from '@/lib/billing'

const TIER_LABEL: Record<string, string> = {
  new: 'Новий',
  regular: 'Постійний',
  partner: 'Партнер',
  vip: 'VIP',
}

const KIND_LABEL: Record<string, string> = {
  subscription: 'Абонплата',
  hourly: 'Погодинно',
  overage: 'Понад ліміт',
  prepaid_advance: 'Аванс',
  prepaid_reconciliation: 'Звірка',
  prepaid_credit: 'Кредит',
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'accent' | 'warn' | 'destructive' }) {
  const color =
    tone === 'warn'
      ? 'var(--wf-warning)'
      : tone === 'destructive'
        ? 'var(--wf-destructive)'
        : tone === 'accent'
          ? 'var(--wf-accent)'
          : 'var(--wf-fg)'
  return (
    <div className="wfp-stat">
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{v}</div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
    </div>
  )
}

/** Approval badge for an on_actuals charge (null = no gate → nothing shown). */
function ApprovalBadge({ status }: { status: PortalCharge['approvalStatus'] }) {
  if (status == null) return null
  const meta = {
    pending: { tone: 'warning' as const, label: 'чекає вашого погодження' },
    approved: { tone: 'success' as const, label: 'погоджено' },
    rejected: { tone: 'muted' as const, label: 'відхилено' },
  }[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
      <StatusDot tone={meta.tone} /> {meta.label}
    </span>
  )
}

function ChargeRow({ c, onDecide }: { c: PortalCharge; onDecide: (c: PortalCharge) => void }) {
  const quote = num(c.amount)
  const final = num(c.totalAmount)
  const discounted = c.approvedAmount != null && final != null && quote != null && final < quote
  const pending = c.approvalStatus === 'pending'
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
        {pending && (
          <Button size="sm" variant="primary" onClick={() => onDecide(c)} style={{ marginTop: 6 }}>
            Погодити
          </Button>
        )}
      </div>
    </div>
  )
}

/** Approve / reject / counter-offer a draft charge. */
function ApprovalModal({ charge, onClose }: { charge: PortalCharge; onClose: () => void }) {
  const decide = useDecideCharge()
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
    decide.mutate(
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
      title="Погодження вартості"
      aux={`${charge.month} · ${formatMoney(billed)} ${charge.currency}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={decide.isPending}>
            Скасувати
          </Button>
          <Button
            variant={mode === 'reject' ? 'danger' : 'primary'}
            loading={decide.isPending}
            onClick={submit}
          >
            {mode === 'approve' ? 'Погодити' : 'Відхилити'}
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
          Погодити
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
          label={`Погодити меншу суму? (необов'язково, ≤ ${formatMoney(billed)})`}
          type="number"
          placeholder={String(billed)}
          value={counter}
          onChange={(e) => setCounter(e.target.value)}
          error={counterInvalid ? 'Сума має бути > 0 і не більше виставленої' : undefined}
        />
      ) : (
        <Input
          label="Причина відхилення"
          placeholder="Напишіть, що не так із оцінкою"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          error={comment.trim() === '' ? 'Вкажіть причину' : undefined}
        />
      )}
      {decide.isError && (
        <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 10 }}>
          Не вдалося — можливо, цей рахунок погоджує команда, не ви.
        </div>
      )}
    </Modal>
  )
}

export function BillingPage() {
  const summary = usePortalSummary()
  const charges = usePortalCharges()
  const payments = usePortalPayments()
  const [tab, setTab] = useState<'charges' | 'payments'>('charges')
  const [deciding, setDeciding] = useState<PortalCharge | null>(null)

  if (summary.isLoading) {
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
  if (summary.isError || !summary.data) {
    return (
      <EmptyState
        title="Не вдалося завантажити фінанси"
        description="Спробуйте оновити сторінку."
        action={<Button onClick={() => void summary.refetch()}>Оновити</Button>}
      />
    )
  }

  const s = summary.data
  const debt = num(s.debt) ?? 0
  const balance = num(s.moneyBalance) ?? 0
  const chargeList = charges.data?.charges ?? []
  const paymentList = payments.data?.payments ?? []
  const pendingCount = chargeList.filter((c) => c.approvalStatus === 'pending').length

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Фінанси</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // рахунки, платежі та реквізити
      </div>

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <Stat k="до сплати" v={`${formatMoney(debt)}`} tone={debt > 0 ? 'warn' : undefined} />
        <Stat k="сплачено всього" v={formatMoney(num(s.totalPaid))} />
        <Stat k="баланс рахунку" v={formatMoney(balance)} tone={balance < 0 ? 'warn' : 'accent'} />
        <Stat
          k={`лояльність · −${s.discountPercent}%`}
          v={TIER_LABEL[s.loyaltyTier] ?? s.loyaltyTier}
        />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}
      >
        <div>
          <div className="wfp-od-tabs" role="tablist" style={{ marginBottom: 4 }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'charges'}
              onClick={() => setTab('charges')}
            >
              Рахунки{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'payments'}
              onClick={() => setTab('payments')}
            >
              Платежі
            </button>
          </div>

          {tab === 'charges' &&
            (chargeList.length === 0 ? (
              <EmptyState
                title="Рахунків ще немає"
                description="Тут зʼявляться ваші нарахування."
              />
            ) : (
              <Card>
                {chargeList.map((c) => (
                  <ChargeRow key={c.id} c={c} onDecide={setDeciding} />
                ))}
              </Card>
            ))}

          {tab === 'payments' &&
            (paymentList.length === 0 ? (
              <EmptyState title="Платежів ще немає" description="Історія оплат буде тут." />
            ) : (
              <Card>
                {paymentList.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      borderBottom: '1px solid var(--wf-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {formatMoney(num(p.amount))} {p.currency}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
                        {formatDate(p.confirmedAt)}
                        {p.paymentMethod ? ` · ${p.paymentMethod}` : ''}
                      </div>
                    </div>
                    <StatusDot tone="success" />
                  </div>
                ))}
              </Card>
            ))}
        </div>

        {/* Sticky pay-to requisites card */}
        <Card title="Як оплатити">
          {s.paymentSettings == null ? (
            <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
              Реквізити ще не вказані.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <Req k="Банк" v={s.paymentSettings.bankName} />
              <Req k="IBAN" v={s.paymentSettings.iban} mono copy />
              <Req k="Отримувач" v={s.paymentSettings.accountName} copy />
              <Req k="USDT" v={s.paymentSettings.cryptoUsdt} mono copy />
              {s.paymentSettings.notes ? (
                <div style={{ color: 'var(--wf-fg-muted)', marginTop: 4 }}>
                  {s.paymentSettings.notes}
                </div>
              ) : null}
            </div>
          )}
          {s.projects.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--wf-border)', paddingTop: 12 }}>
              <div
                className="wfp-mono"
                style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
              >
                // проєкти
              </div>
              {s.projects.map((p) => (
                <div key={p.id} style={{ fontSize: 13, marginBottom: 6 }}>
                  {p.name}
                  {p.amount ? (
                    <span style={{ color: 'var(--wf-fg-muted)' }}>
                      {' '}
                      — {formatMoney(num(p.amount))} {p.currency}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {deciding && <ApprovalModal charge={deciding} onClose={() => setDeciding(null)} />}
    </div>
  )
}

function Req({
  k,
  v,
  mono,
  copy,
}: {
  k: string
  v: string | null
  mono?: boolean
  copy?: boolean
}) {
  const [copied, setCopied] = useState(false)
  if (!v) return null
  const value = v
  const doCopy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
    >
      <span style={{ color: 'var(--wf-fg-muted)', flexShrink: 0 }}>{k}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          textAlign: 'right',
        }}
      >
        <span
          className={mono ? 'wfp-mono' : undefined}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {value}
        </span>
        {copy && (
          <button
            type="button"
            onClick={doCopy}
            title="Скопіювати"
            aria-label={`Скопіювати ${k}`}
            style={{
              border: 0,
              background: 'none',
              cursor: 'pointer',
              color: copied ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
              fontSize: 12,
              padding: 0,
              flexShrink: 0,
            }}
          >
            {copied ? '✓' : '⧉'}
          </button>
        )}
      </span>
    </div>
  )
}
