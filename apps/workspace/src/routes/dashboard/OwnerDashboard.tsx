import { useNavigate } from 'react-router-dom'
import { OrderInternalStatus } from '@workflo/types'
import { EmptyState, Icon, Skeleton } from '@workflo/ui'
import { Donut, type DonutSegment } from '@/components/Donut'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { useBillingOverview, num } from '@/lib/billing'
import { usePnl, isoDay } from '@/lib/finance'
import { useOrders, countByStatus, type WorkspaceOrder } from '@/lib/orders'
import { KanbanBoard } from '@/routes/orders/KanbanBoard'

/** Expense-category display (label + donut color), shared with /finance category labels. */
const CAT: Record<string, { label: string; color: string }> = {
  infrastructure: { label: 'Інфра', color: '#22D3EE' },
  software: { label: 'ПЗ', color: '#A78BFA' },
  salary: { label: 'ЗП', color: '#C5F82A' },
  contractor: { label: 'Підрядники', color: '#FB923C' },
  rent: { label: 'Оренда', color: '#F472B6' },
  tax: { label: 'Податки', color: '#F87171' },
  marketing: { label: 'Маркетинг', color: '#38BDF8' },
  other: { label: 'Інше', color: '#94A3B8' },
}

/** Owner home — agency-wide overview: finance KPIs + expense donut, then orders attention/board. */
export function OwnerDashboard() {
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const { data, isLoading, isError } = useOrders({})
  const { data: unassigned, isError: unassignedErr } = useOrders({ assigneeId: 'none' })
  // Finance widgets are owner-only (manager is finance-blocked) — gate the queries so a manager
  // viewing this dashboard never fires the 403'd billing/pnl endpoints.
  const overview = useBillingOverview(isOwner)
  // Current-month P&L drives the net-profit/expense KPIs + the donut.
  const monthFrom = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()
  const pnl = usePnl(monthFrom, isoDay(new Date()), isOwner)
  const orders = data?.orders ?? []

  const o = overview.data
  const p = pnl.data
  const expenseSegs: DonutSegment[] = (p?.byCategory ?? [])
    .map((c) => ({
      label: CAT[c.category]?.label ?? c.category,
      value: num(c.amountUsd) ?? 0,
      color: CAT[c.category]?.color ?? '#94A3B8',
    }))
    .filter((s) => s.value > 0)
  const totalExpenses = expenseSegs.reduce((s, x) => s + x.value, 0)
  const netProfit = num(p?.netProfitUsd) ?? 0
  const clientDebt = num(o?.outstandingDebt) ?? 0

  const queue = countByStatus(orders, [OrderInternalStatus.NEW, OrderInternalStatus.CLARIFICATION])
  const inProgress = countByStatus(orders, [
    OrderInternalStatus.IN_PROGRESS,
    OrderInternalStatus.REVISION,
  ])
  const review = countByStatus(orders, [OrderInternalStatus.REVIEW])
  const done = countByStatus(orders, [OrderInternalStatus.DONE])

  const isActive = (o: WorkspaceOrder) =>
    o.internalStatus !== OrderInternalStatus.DONE &&
    o.internalStatus !== OrderInternalStatus.CANCELLED
  const overdue = orders.filter(
    (o) => isActive(o) && o.dueDate != null && new Date(o.dueDate).getTime() < Date.now()
  )
  const unassignedCount = unassigned?.orders.length ?? 0

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Огляд</h1>
          <div className="wfp-ph-sub">
            // {data?.pagination.total ?? orders.length} замовлень · агенція
          </div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn wfp-btn--primary" onClick={() => navigate('/orders')}>
            <Icon name="kanban" size={14} />
            Усі замовлення
          </button>
        </div>
      </div>

      {isOwner && (
        <>
          {/* ── Фінанси (design-v2 owner overview) ── */}
          <div className="wfp-stats" style={{ marginBottom: 14 }}>
            <div className="wfp-stat">
              <div className="wfp-stat-k">дохід / місяць</div>
              <div className="wfp-stat-v wfp-stat-v--accent">
                {formatMoney(num(o?.monthlyRevenueUsd))}
              </div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">борг клієнтів</div>
              <div className={`wfp-stat-v${clientDebt > 0 ? ' wfp-stat-v--warn' : ''}`}>
                {formatMoney(clientDebt)}
              </div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">чистий · {p?.marginPct ?? '—'}%</div>
              <div
                className={`wfp-stat-v ${netProfit < 0 ? 'wfp-stat-v--warn' : 'wfp-stat-v--accent'}`}
              >
                {formatMoney(num(p?.netProfitUsd))}
              </div>
              <div className="wfp-stat-sub">цей місяць</div>
            </div>
            <div className="wfp-stat">
              <div className="wfp-stat-k">витрати / місяць</div>
              <div className="wfp-stat-v">{formatMoney(num(p?.expensesUsd))}</div>
            </div>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}
          >
            <div className="wfp-card">
              <div
                className="wfp-mono"
                style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
              >
                // витрати за категоріями · цей місяць
              </div>
              {pnl.isLoading ? (
                <Skeleton style={{ height: 132 }} />
              ) : expenseSegs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
                  Витрат цього місяця немає.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                  <Donut
                    data={expenseSegs}
                    centerValue={formatMoney(totalExpenses)}
                    centerLabel="витрати"
                  />
                  <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                    {expenseSegs.map((s) => (
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
            </div>

            <div className="wfp-card">
              <div
                className="wfp-mono"
                style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
              >
                // топ боржників
              </div>
              {!o || o.topDebtors.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Боргів немає 🎉</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {o.topDebtors.map((d) => (
                    <div
                      key={d.companyId}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.name}
                      </span>
                      <span style={{ color: 'var(--wf-warning)', fontWeight: 600 }}>
                        {formatMoney(num(d.debt))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
          >
            // замовлення
          </div>
        </>
      )}

      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">нових</div>
          <div className="wfp-stat-v">{queue}</div>
          <div className="wfp-stat-sub">потребують уваги</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">в роботі</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{inProgress}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">на рев’ю</div>
          <div className="wfp-stat-v wfp-stat-v--warn">{review}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">завершено</div>
          <div className="wfp-stat-v">{done}</div>
          <div className="wfp-stat-sub">за весь час</div>
        </div>
      </div>

      {(overdue.length > 0 || unassignedCount > 0 || unassignedErr) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <AttentionItem
            icon="alert"
            color="var(--wf-destructive)"
            title="Прострочені дедлайни"
            value={overdue.length}
            hint={
              overdue
                .slice(0, 3)
                .map((o) => o.title)
                .join(' · ') || '—'
            }
          />
          {(unassignedCount > 0 || unassignedErr) && (
            <AttentionItem
              icon="users"
              color="var(--wf-fg-muted)"
              title="Замовлення без виконавця"
              // Don't silently coalesce a failed count to 0 — show that it couldn't load.
              value={unassignedErr ? '—' : unassignedCount}
              hint={unassignedErr ? 'не вдалося порахувати — оновіть' : 'потребують призначення'}
              onClick={() => navigate('/orders')}
            />
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : isError ? (
        <EmptyState
          glyph="// error"
          title="Не вдалося завантажити замовлення"
          description="Спробуйте оновити сторінку."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Ще немає замовлень"
          description="Коли клієнти створять замовлення, вони зʼявляться тут."
        />
      ) : (
        <KanbanBoard orders={orders} doneCount={done} />
      )}
    </div>
  )
}

function AttentionItem({
  icon,
  color,
  title,
  value,
  hint,
  onClick,
}: {
  icon: 'alert' | 'users' | 'receipt'
  color: string
  title: string
  value: number | string
  hint: string
  onClick?: () => void
}) {
  return (
    <div
      className="wfp-card"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 12,
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: `color-mix(in oklab, ${color} 12%, transparent)`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div
          className="wfp-mono"
          style={{
            fontSize: 11,
            color: 'var(--wf-fg-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hint}
        </div>
      </div>
      <span
        className="wfp-mono"
        style={{ fontSize: 22, fontWeight: 600, color, fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </span>
    </div>
  )
}
