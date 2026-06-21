import { useState } from 'react'
import { Button, Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { formatDate, formatMoney } from '@/lib/format'
import {
  num,
  useWallet,
  useWalletStatement,
  useWalletTransactions,
  type WalletTxn,
} from '@/lib/wallet'

const SOURCE_LABEL: Record<string, string> = {
  referral_bonus: 'Реферальний бонус',
  manual_adjustment: 'Коригування',
  invoice_payment: 'Оплата рахунку',
  refund: 'Повернення',
}

const MONEY_STATUS: Record<string, { tone: 'success' | 'warning' | 'muted'; label: string }> = {
  prepaid: { tone: 'success', label: 'передоплата' },
  owing: { tone: 'warning', label: 'є борг' },
  settled: { tone: 'muted', label: 'нуль' },
}

const TIMELINE_LABEL: Record<string, string> = {
  charge: 'Нарахування',
  payment: 'Платіж',
  bonus: 'Бонус',
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

function TxnRow({ t }: { t: WalletTxn }) {
  const credit = t.type === 'credit'
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
        <div style={{ fontWeight: 600 }}>{SOURCE_LABEL[t.source] ?? t.source}</div>
        <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)' }}>
          {formatDate(t.createdAt)}
          {t.note ? <span style={{ color: 'var(--wf-fg-muted)' }}> · {t.note}</span> : null}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 600, color: credit ? 'var(--wf-accent)' : 'var(--wf-fg)' }}>
          {credit ? '+' : '−'}
          {formatMoney(num(t.amount))} {t.currency}
        </div>
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          баланс {formatMoney(num(t.balanceAfter))}
        </div>
      </div>
    </div>
  )
}

export function WalletPage() {
  const wallet = useWallet()
  const txns = useWalletTransactions()
  const statement = useWalletStatement()
  const [tab, setTab] = useState<'ledger' | 'statement'>('ledger')

  if (wallet.isLoading) {
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
  if (wallet.isError || !wallet.data) {
    return (
      <EmptyState
        title="Не вдалося завантажити гаманець"
        description="Спробуйте оновити сторінку."
        action={<Button onClick={() => void wallet.refetch()}>Оновити</Button>}
      />
    )
  }

  const w = wallet.data
  const money = num(w.moneyBalance) ?? 0
  const txnList = txns.data?.transactions ?? []
  const timeline = statement.data?.timeline ?? []
  const moneyStatus = statement.data?.money.status

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Гаманець</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // бонусний рахунок і баланс грошей
      </div>

      <div className="wfp-stats" style={{ marginBottom: 18 }}>
        <Stat k="бонуси" v={`${formatMoney(num(w.bonusBalance))}`} tone="accent" />
        <Stat
          k="баланс рахунку"
          v={`${formatMoney(money)} ${w.currency}`}
          tone={money < 0 ? 'warn' : undefined}
        />
        <Stat
          k="статус"
          v={moneyStatus ? (MONEY_STATUS[moneyStatus]?.label ?? moneyStatus) : '—'}
        />
      </div>

      <div className="wfp-od-tabs" role="tablist" style={{ marginBottom: 4 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ledger'}
          onClick={() => setTab('ledger')}
        >
          Бонусні операції
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'statement'}
          onClick={() => setTab('statement')}
        >
          Виписка
        </button>
      </div>

      {tab === 'ledger' &&
        (txns.isLoading ? (
          <Skeleton />
        ) : txnList.length === 0 ? (
          <EmptyState
            title="Операцій ще немає"
            description="Тут зʼявляться бонусні нарахування й списання."
          />
        ) : (
          <Card>
            {txnList.map((t) => (
              <TxnRow key={t.id} t={t} />
            ))}
          </Card>
        ))}

      {tab === 'statement' &&
        (statement.isLoading ? (
          <Skeleton />
        ) : timeline.length === 0 ? (
          <EmptyState title="Виписка порожня" description="Рухи коштів зʼявляться тут." />
        ) : (
          <Card>
            {timeline.map((e, i) => {
              const positive = e.kind === 'payment' || e.kind === 'bonus'
              return (
                <div
                  key={`${e.kind}-${e.date}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--wf-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusDot tone={positive ? 'success' : 'muted'} />
                    <span>{TIMELINE_LABEL[e.kind] ?? e.kind}</span>
                    <span
                      className="wfp-mono"
                      style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}
                    >
                      {formatDate(e.date)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: positive ? 'var(--wf-accent)' : 'var(--wf-fg)',
                    }}
                  >
                    {positive ? '+' : '−'}
                    {formatMoney(num(e.amount))}
                  </div>
                </div>
              )
            })}
          </Card>
        ))}
    </div>
  )
}
