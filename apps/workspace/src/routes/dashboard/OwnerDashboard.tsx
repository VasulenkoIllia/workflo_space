import { useNavigate } from 'react-router-dom'
import { OrderClientStatus, OrderInternalStatus } from '@workflo/types'
import { EmptyState, Icon, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatMoney } from '@/lib/format'
import { useBillingOverview, useWsCharges, num } from '@/lib/billing'
import { useUnansweredChats } from '@/lib/chats'
import { useLeads } from '@/lib/leads'
import { usePayouts, useTeam } from '@/lib/payouts'
import { useProjects, type FinProject } from '@/lib/projects'
import { useOrders, type WorkspaceOrder } from '@/lib/orders'
import { useMomReport, type MomReport } from '@/lib/reports'

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

const ACTIVE_END: OrderInternalStatus[] = [OrderInternalStatus.DONE, OrderInternalStatus.CANCELLED]

/** DSN-1 (workspace-screens.jsx): дашборд = вікно в дошку/замовлення, не другий канбан.
 * Stats-стріп + 4 slice-панелі (Прострочені · На перевірці · Без виконавця · Абонплата) +
 * owner-блок «Фінанси та клієнти» (4 action-items). Донат/канбан живуть у /finance та /orders. */
export function OwnerDashboard() {
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const { data, isLoading, isError } = useOrders({})
  const { data: unassignedData, isError: unassignedErr } = useOrders({ assigneeId: 'none' })
  // Фінанс-віджети — owner-only (manager finance-blocked): гейтимо запити, щоб не ловити 403.
  const overview = useBillingOverview(isOwner)
  const mom = useMomReport(isOwner)
  const pendingCharges = useWsCharges('pending', isOwner)
  const projects = useProjects(isOwner)
  const leads = useLeads()
  const period = new Date().toISOString().slice(0, 7)
  const payouts = usePayouts(isOwner ? period : '')

  const orders = data?.orders ?? []
  const o = overview.data

  const isActive = (x: WorkspaceOrder) =>
    x.internalStatus != null && !ACTIVE_END.includes(x.internalStatus)
  const overdue = orders.filter(
    (x) => isActive(x) && x.dueDate != null && new Date(x.dueDate).getTime() < Date.now()
  )
  const inReview = orders.filter((x) => x.internalStatus === OrderInternalStatus.REVIEW)
  const unassigned = (unassignedData?.orders ?? []).filter(isActive)
  const inWork = orders.filter(isActive)
  // «Очікують клієнта» = оцінка надіслана, клієнт ще не погодив (02-А)
  const waitingClient = orders.filter((x) => x.clientStatus === OrderClientStatus.PENDING_APPROVAL)
  // «Абонплата · авто» — активні цикл-проєкти (авто-нарахування за розкладом)
  const abonProjects = (projects.data?.projects ?? []).filter(
    (p) => p.active && p.nextCycleAt != null
  )

  // Action-items (owner)
  const pendingList = isOwner ? (pendingCharges.data?.charges ?? []) : []
  const pendingSum = pendingList.reduce((s, c) => s + (num(c.totalAmount ?? c.amount) ?? 0), 0)
  const weekAgo = Date.now() - 7 * 86_400_000
  const newLeads = (leads.data?.leads ?? []).filter(
    (l) => new Date(l.createdAt).getTime() >= weekAgo
  )
  const payoutRows = payouts.data?.payouts ?? []
  const payoutPending = payoutRows.filter((p) => p.status !== 'paid')
  const payoutPendingSum = payoutPending.reduce((s, p) => s + (num(p.total) ?? 0), 0)

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Огляд</h1>
          <div className="wfp-ph-sub">
            // зведення по агенції · {inWork.length} у роботі · {data?.pagination.total ?? '—'}{' '}
            замовлень
            {isOwner && o ? ` · виручка ${formatMoney(num(o.monthlyRevenueUsd))} за місяць` : ''}
          </div>
        </div>
        <div className="wfp-ph-r">
          <button className="wfp-btn" onClick={() => navigate('/orders')}>
            <Icon name="kanban" size={14} />
            Замовлення
          </button>
          <button className="wfp-btn wfp-btn--primary" onClick={() => navigate('/board')}>
            <Icon name="kanban" size={14} />
            Дошка задач
          </button>
        </div>
      </div>

      <UnansweredChatsCard />

      {/* ── Stats-стріп (дизайн): у роботі · прострочено · очікують клієнта · виручка ── */}
      <div className="wfp-stats" style={{ marginBottom: 14 }}>
        <div className="wfp-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/board')}>
          <div className="wfp-stat-k">у роботі</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{inWork.length}</div>
          <div className="wfp-stat-sub">по всіх командах</div>
        </div>
        <div className="wfp-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/orders')}>
          <div className="wfp-stat-k">прострочено</div>
          <div className={`wfp-stat-v${overdue.length ? ' wfp-stat-v--warn' : ''}`}>
            {overdue.length}
          </div>
          <div className="wfp-stat-sub">потребують уваги</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">очікують клієнта</div>
          <div className="wfp-stat-v">{waitingClient.length}</div>
          <div className="wfp-stat-sub">
            {waitingClient[0]?.title ? waitingClient[0].title.slice(0, 28) : '—'}
          </div>
        </div>
        {isOwner && (
          <div className="wfp-stat">
            <div className="wfp-stat-k">виручка · місяць</div>
            <div className="wfp-stat-v">{formatMoney(num(o?.monthlyRevenueUsd))}</div>
            <div className="wfp-stat-sub">
              {mom.data ? <MomDelta pct={mom.data.pct.revenueUsd} /> : '—'} до минулого
            </div>
          </div>
        )}
      </div>

      {isOwner && mom.data && <MomStrip mom={mom.data} />}

      {/* ── Board-slices (дизайн wfd-grid): вікна в дошку, не другий канбан ── */}
      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : isError ? (
        <EmptyState
          glyph="// error"
          title="Не вдалося завантажити замовлення"
          description="Спробуйте оновити сторінку."
        />
      ) : (
        <div className="wfd-grid">
          <SlicePanel
            icon="alert"
            color="var(--wf-destructive)"
            title="Прострочені"
            link="відкрити замовлення →"
            onLink={() => navigate('/orders')}
            empty="— все вчасно —"
            rows={overdue}
            onRow={(id) => navigate(`/orders/${id}`)}
          />
          <SlicePanel
            icon="check"
            color="var(--wf-warning)"
            title="На перевірці / здача"
            link="відкрити замовлення →"
            onLink={() => navigate('/orders?status=review')}
            empty="— порожньо —"
            rows={inReview}
            onRow={(id) => navigate(`/orders/${id}`)}
          />
          <SlicePanel
            icon="users"
            color="var(--wf-fg-muted)"
            title="Без виконавця"
            link="розподілити →"
            onLink={() => navigate('/orders')}
            empty={unassignedErr ? 'не вдалося порахувати — оновіть' : '— всі розподілені —'}
            rows={unassigned}
            onRow={(id) => navigate(`/orders/${id}`)}
          />
          <div className="wfd-panel">
            <div className="wfd-panel-h">
              <span className="wfd-panel-t">
                <Icon name="bell" size={14} style={{ color: '#A78BFA' }} />
                Абонплата · авто
              </span>
              <button className="wfd-panel-link" onClick={() => navigate('/projects')}>
                відкрити проєкти →
              </button>
            </div>
            {!isOwner ? (
              <div className="wfd-empty">— фінанси доступні власнику —</div>
            ) : abonProjects.length === 0 ? (
              <div className="wfd-empty">— немає —</div>
            ) : (
              abonProjects.slice(0, 5).map((p) => <AbonRow key={p.id} project={p} />)
            )}
          </div>
        </div>
      )}

      {/* ── Owner: «Фінанси та клієнти» — action items (дизайн) ── */}
      {isOwner && (
        <div style={{ marginTop: 24 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
          >
            // фінанси та клієнти · action items
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ActionItem
              icon="receipt"
              color="var(--wf-warning)"
              title="Нарахування на погодженні"
              value={pendingList.length}
              tag={
                pendingList.length
                  ? `${formatMoney(pendingSum)} · чекають рішення клієнта`
                  : 'все погоджено'
              }
              onClick={() => navigate('/billing')}
            />
            <ActionItem
              icon="alert"
              color="var(--wf-warning)"
              title="Боржники"
              value={o?.topDebtors.length ?? 0}
              tag={
                o && o.topDebtors.length
                  ? `${o.topDebtors
                      .slice(0, 3)
                      .map((d) => d.name)
                      .join(' + ')} · ${formatMoney(num(o.outstandingDebt))}`
                  : 'боргів немає 🎉'
              }
              onClick={() => navigate('/billing')}
            />
            <ActionItem
              icon="building"
              color="var(--wf-accent)"
              title="Нових лідів за тиждень"
              value={newLeads.length}
              tag={newLeads.length ? 'переглянути дошку лідів' : 'нових звернень не було'}
              onClick={() => navigate('/leads')}
            />
            <ActionItem
              icon="coins"
              color="var(--wf-fg-muted)"
              title={`Виплати · ${period}`}
              value={formatMoney(payoutPendingSum)}
              tag={
                payoutPending.length
                  ? `${payoutPending.length} нараховано · очікує підтвердження`
                  : 'все виплачено'
              }
              onClick={() => navigate('/payouts')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** Slice-панель дизайну: міні-рядки замовлень з дедлайном і виконавцем. */
function SlicePanel({
  icon,
  color,
  title,
  link,
  onLink,
  empty,
  rows,
  onRow,
}: {
  icon: 'alert' | 'check' | 'users'
  color: string
  title: string
  link: string
  onLink: () => void
  empty: string
  rows: WorkspaceOrder[]
  onRow: (id: string) => void
}) {
  return (
    <div className="wfd-panel">
      <div className="wfd-panel-h">
        <span className="wfd-panel-t">
          <Icon name={icon} size={14} style={{ color }} />
          {title}
        </span>
        <button className="wfd-panel-link" onClick={onLink}>
          {link}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="wfd-empty">{empty}</div>
      ) : (
        rows.slice(0, 5).map((r) => {
          const over = r.dueDate != null && new Date(r.dueDate).getTime() < Date.now()
          return (
            <div
              key={r.id}
              className="wfd-mini-row"
              data-status={over ? 'overdue' : 'wip'}
              onClick={() => onRow(r.id)}
            >
              <span className="wfd-mini-id">#{r.id.slice(0, 6)}</span>
              <span className="wfd-mini-title">{r.title}</span>
              <span className="wfd-mini-due" data-status={over ? 'overdue' : 'wip'}>
                {r.dueDate ? `${over ? '⚠ ' : ''}${formatDate(r.dueDate)}` : '—'}
              </span>
              {r.assignee ? (
                <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {r.assignee.name.split(' ')[0]}
                </span>
              ) : (
                <span className="wfd-mini-noone">?</span>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

/** Рядок абон-проєкту: назва + наступний цикл (авто-нарахування). */
function AbonRow({ project }: { project: FinProject }) {
  const navigate = useNavigate()
  return (
    <div
      className="wfd-mini-row"
      data-status="wip"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <span className="wfd-mini-id">₴</span>
      <span className="wfd-mini-title">{project.name}</span>
      <span className="wfd-mini-due" data-status="wip">
        цикл: {project.nextCycleAt ? formatDate(project.nextCycleAt) : '—'}
      </span>
      <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        {project.abonAmount ? formatMoney(num(project.abonAmount)) : ''}
      </span>
    </div>
  )
}

function ActionItem({
  icon,
  color,
  title,
  value,
  tag,
  onClick,
}: {
  icon: 'alert' | 'users' | 'receipt' | 'building' | 'coins'
  color: string
  title: string
  value: number | string
  tag: string
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
          {tag}
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
