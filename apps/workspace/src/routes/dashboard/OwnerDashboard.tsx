import { useNavigate } from 'react-router-dom'
import { OrderInternalStatus } from '@workflo/types'
import { EmptyState, Icon, Skeleton } from '@workflo/ui'
import { Donut, type DonutSegment } from '@/components/Donut'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney } from '@/lib/format'
import { useBillingOverview, num } from '@/lib/billing'
import { useUnansweredChats } from '@/lib/chats'
import { useTeam } from '@/lib/payouts'
import { usePnl, isoDay } from '@/lib/finance'
import { catColor, catLabel } from '@/lib/expenseCategories'
import { useOrders, countByStatus, type WorkspaceOrder } from '@/lib/orders'
import { useMomReport, type MomReport } from '@/lib/reports'
import { KanbanBoard } from '@/routes/orders/KanbanBoard'

/** 19-Д: «+12%» / «−8%» / «—» — дельта MoM, зелений угору / червоний униз. */
function MomDelta({ pct }: { pct: number | null }) {
  if (pct == null)
    return (
      <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        —
      </span>
    )
  const up = pct >= 0
  return (
    <span
      className="wfp-mono"
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: up ? 'var(--wf-accent)' : 'var(--wf-destructive)',
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

/** 19-Д: рядок «місяць до місяця» — поточні значення + дельта проти попереднього. */
function MomStrip({ mom }: { mom: MomReport }) {
  const items: { label: string; value: string; pct: number | null }[] = [
    { label: 'виручка', value: `${mom.current.revenueUsd} USD`, pct: mom.pct.revenueUsd },
    { label: 'замовлення', value: String(mom.current.ordersCreated), pct: mom.pct.ordersCreated },
    { label: 'ліди', value: String(mom.current.leadsCreated), pct: mom.pct.leadsCreated },
    { label: 'години', value: String(mom.current.hoursLogged), pct: mom.pct.hoursLogged },
  ]
  return (
    <div
      className="wfp-mono"
      style={{
        display: 'flex',
        gap: 18,
        flexWrap: 'wrap',
        alignItems: 'center',
        fontSize: 12,
        padding: '8px 12px',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--wf-fg-muted)', textTransform: 'uppercase' }}>
        місяць до місяця
      </span>
      {items.map((i) => (
        <span key={i.label} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <span style={{ color: 'var(--wf-fg-muted)', fontSize: 11 }}>{i.label}</span>
          <span style={{ fontWeight: 600 }}>{i.value}</span>
          <MomDelta pct={i.pct} />
        </span>
      ))}
    </div>
  )
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
  // 19-Д: дельти MoM (owner-only endpoint)
  const mom = useMomReport(isOwner)
  const orders = data?.orders ?? []

  const o = overview.data
  const p = pnl.data
  const expenseSegs: DonutSegment[] = (p?.byCategory ?? [])
    .map((c) => ({
      label: catLabel(c.category),
      value: num(c.amountUsd) ?? 0,
      color: catColor(c.category),
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

      <UnansweredChatsCard />

      {isOwner && (
        <>
          {/* 19-Д: ±% MoM */}
          {mom.data && <MomStrip mom={mom.data} />}

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

/** 18-Г «без відповіді > N год»: активні замовлення, де клієнт чекає на відповідь команди.
 * Рендериться лише коли є що показати. */
function UnansweredChatsCard() {
  const navigate = useNavigate()
  const { data } = useUnansweredChats(4)
  const { data: teamData } = useTeam()
  const nameOf = (id: string | null) =>
    teamData?.members.find((m) => m.profileId === id)?.name ?? 'не призначено'
  const rows = data?.unanswered ?? []
  if (rows.length === 0) return null
  return (
    <div
      className="wfp-card"
      style={{ marginBottom: 14, borderColor: 'var(--wf-warning, #b45309)' }}
    >
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-warning, #b45309)', marginBottom: 8 }}
      >
        // чати без відповіді довше 4 год · {rows.length}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.slice(0, 6).map((r) => (
          <button
            key={r.orderId}
            type="button"
            onClick={() => navigate(`/orders/${r.orderId}`)}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'baseline',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--wf-fg)',
              textAlign: 'left',
              fontSize: 13,
            }}
          >
            <span
              className="wfp-mono"
              style={{ fontSize: 11, color: 'var(--wf-destructive)', width: 52, flexShrink: 0 }}
            >
              {r.hoursSince} год
            </span>
            <span style={{ fontWeight: 500 }}>{r.title}</span>
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              {r.companyName ?? ''} · відп.: {nameOf(r.chatOwnerId)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
