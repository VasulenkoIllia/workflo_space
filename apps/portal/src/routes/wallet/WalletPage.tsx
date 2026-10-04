import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Skeleton, Tabs } from '@workflo/ui'
import { LoadError } from '@workflo/app-core'
import { useCompanyAccess } from '@/lib/companyAccess'
import { formatDate, formatMoney } from '@/lib/format'
import {
  num,
  useWallet,
  useWalletStatement,
  useWalletTransactions,
  type WalletStatement,
  type WalletTxn,
} from '@/lib/wallet'

/**
 * DSN-6 · design-v2 workspace-wallet.jsx → WalletPortal: hero з двома балансами (бонусний ·
 * грошовий) + таби Транзакції · Виписка · Правила. БЕЗ «Поповнити» — онлайн-поповнення
 * прийде з платіжним шлюзом (S14); зараз гроші надходять оплатою рахунків за реквізитами.
 */

const SOURCE_LABEL: Record<string, string> = {
  referral_bonus: 'Реферальний бонус',
  manual_adjustment: 'Коригування агенції',
  invoice_payment: 'Оплата рахунку бонусами',
  refund: 'Повернення бонусів',
}

type TxnFilter = 'all' | 'credit' | 'debit' | 'referral'
const FILTERS: { id: TxnFilter; label: string }[] = [
  { id: 'all', label: 'всі' },
  { id: 'credit', label: 'нарахування' },
  { id: 'debit', label: 'списання' },
  { id: 'referral', label: 'реферали' },
]

const TIMELINE_LABEL: Record<WalletStatement['timeline'][number]['kind'], string> = {
  charge: 'Рахунок виставлено',
  payment: 'Оплату отримано',
  bonus: 'Бонус',
}

// Правила — як реально працює система (bonusSpend / moneyBalance), не рекламні обіцянки
const RULES: [string, string][] = [
  [
    'Бонуси',
    'Нараховуються за рекомендації (реферальна програма) і коригуваннями агенції. Це не гроші — лише знижка на послуги, виведенню не підлягають.',
  ],
  [
    'Застосування бонусів',
    'Власник компанії може погасити бонусами будь-який відкритий рахунок — частково або повністю («Рахунки й борг» → «Оплатити бонусом»).',
  ],
  [
    'Грошовий баланс',
    'Оплати мінус нарахування (абонплата, послуги). Відʼємний — борг, додатний — передоплата, що зараховується в наступні рахунки. Борг за окремими замовленнями видно в «Рахунки й борг».',
  ],
  [
    'Поповнення',
    'Онлайн-поповнення зʼявиться з платіжним шлюзом. Зараз оплата — за реквізитами з рахунку; агенція підтверджує платіж, і баланс оновлюється.',
  ],
  ['Лояльність', 'Знижка за рівнем лояльності застосовується до рахунків автоматично.'],
]

export function WalletPage() {
  const navigate = useNavigate()
  const { isOwner } = useCompanyAccess()
  const wallet = useWallet()
  const txns = useWalletTransactions()
  const statement = useWalletStatement()
  const [tab, setTab] = useState('transactions')
  const [filter, setFilter] = useState<TxnFilter>('all')

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
    return <LoadError what="гаманець" onRetry={() => void wallet.refetch()} />
  }

  const w = wallet.data
  const bonus = num(w.bonusBalance) ?? 0
  const money = num(w.moneyBalance) ?? 0
  const owes = money < 0
  const txnList = (txns.data?.transactions ?? []).filter((t) =>
    filter === 'all'
      ? true
      : filter === 'referral'
        ? t.source === 'referral_bonus'
        : t.type === filter
  )
  const timeline = statement.data?.timeline ?? []

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Гаманець</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // баланс компанії · бонуси з рефералів і лояльності
      </div>

      <div className="wfw-hero">
        <div className="wfw-bal" data-kind="bonus">
          <div className="wfw-bal-label">
            <Icon name="star" size={13} />
            бонусний баланс
          </div>
          <div className="wfw-bal-v">{formatMoney(bonus)}</div>
          <div className="wfw-bal-sub">з рефералів і коригувань · гаситься будь-який рахунок</div>
          {isOwner && bonus > 0 && (
            <div className="wfw-bal-actions">
              <Button size="sm" onClick={() => navigate('/billing')}>
                Застосувати до рахунку
              </Button>
            </div>
          )}
        </div>
        <div className="wfw-bal" data-kind="money" data-owes={owes || undefined}>
          <div className="wfw-bal-label">
            <Icon name="receipt" size={13} />
            грошовий баланс
          </div>
          <div className="wfw-bal-v">
            {formatMoney(money)} <span style={{ fontSize: 16 }}>{w.currency}</span>
          </div>
          <div className="wfw-bal-sub">
            {owes
              ? 'борг за нарахуваннями · повна картина — у «Рахунки й борг»'
              : money > 0
                ? 'передоплата — зарахується в наступні рахунки'
                : 'розрахунки закриті'}
          </div>
          {owes && (
            <div className="wfw-bal-actions">
              <Button size="sm" variant="primary" onClick={() => navigate('/billing')}>
                До рахунків
              </Button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'transactions', label: 'Транзакції' },
            { id: 'statement', label: 'Виписка' },
            { id: 'rules', label: 'Правила' },
          ]}
        />
      </div>

      {tab === 'transactions' && (
        <>
          <div className="wfw-chips">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="wfw-chip"
                data-on={filter === f.id || undefined}
                onClick={() => setFilter(f.id)}
                style={{
                  background: filter === f.id ? undefined : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {txns.isLoading ? (
            <Skeleton />
          ) : txns.isError ? (
            <LoadError what="транзакції" onRetry={() => void txns.refetch()} />
          ) : txnList.length === 0 ? (
            <EmptyState
              title="Операцій ще немає"
              description="Тут зʼявляться бонусні нарахування й списання."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="wfp-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th style={{ width: '42%' }}>Опис</th>
                    <th className="wfp-num">Сума</th>
                    <th className="wfp-num">Баланс</th>
                  </tr>
                </thead>
                <tbody>
                  {txnList.map((t) => (
                    <TxnRow key={t.id} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'statement' && (
        <div style={{ marginTop: 18 }}>
          {statement.isLoading ? (
            <Skeleton />
          ) : statement.isError ? (
            <LoadError what="виписку" onRetry={() => void statement.refetch()} />
          ) : timeline.length === 0 ? (
            <EmptyState title="Виписка порожня" description="Рухи коштів зʼявляться тут." />
          ) : (
            <div className="wfw-timeline">
              {timeline.map((e, i) => {
                const color =
                  e.kind === 'payment'
                    ? 'var(--wf-success)'
                    : e.kind === 'bonus'
                      ? 'var(--wf-accent)'
                      : 'var(--wf-destructive)'
                return (
                  <div className="wfw-tl-item" data-k={e.kind} key={`${e.kind}-${e.date}-${i}`}>
                    <div className="wfw-tl-head">
                      <span className="wfw-tl-date">{formatDate(e.date)}</span>
                      <span className="wfw-tl-title">{TIMELINE_LABEL[e.kind] ?? e.kind}</span>
                      <span className="wfw-tl-amt" style={{ color }}>
                        {e.kind === 'charge' ? '−' : '+'}
                        {formatMoney(num(e.amount))}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <div style={{ marginTop: 18 }}>
          {RULES.map(([k, v]) => (
            <div className="wfw-rule" key={k}>
              <span className="wfw-rule-k">{k}</span>
              <span className="wfw-rule-v">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TxnRow({ t }: { t: WalletTxn }) {
  const credit = t.type === 'credit'
  return (
    <tr>
      <td className="wfp-mono">{formatDate(t.createdAt)}</td>
      <td>
        <span className="wfw-kind">
          <span className="wfw-kind-ic" data-k="bonus">
            <Icon name={credit ? 'star' : 'receipt'} size={13} />
          </span>
          <span>
            {SOURCE_LABEL[t.source] ?? t.source}
            {t.note ? (
              <span style={{ color: 'var(--wf-fg-muted)', fontSize: 12 }}> · {t.note}</span>
            ) : null}
          </span>
        </span>
      </td>
      <td className="wfp-num">
        <span className="wfw-amt" data-bonus={credit || undefined} data-pos={credit}>
          {credit ? '+' : '−'}
          {formatMoney(num(t.amount))}
        </span>
      </td>
      <td className="wfp-num wfp-mono">{formatMoney(num(t.balanceAfter))}</td>
    </tr>
  )
}
