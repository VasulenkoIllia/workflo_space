import { useNavigate } from 'react-router-dom'
import { OrderInternalStatus } from '@workflo/types'
import { EmptyState, Icon, Skeleton } from '@workflo/ui'
import { useOrders, countByStatus, type WorkspaceOrder } from '@/lib/orders'
import { KanbanBoard } from '@/routes/orders/KanbanBoard'

/** Owner home — agency-wide overview: stats, attention items, all-orders board. */
export function OwnerDashboard() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useOrders({})
  const { data: unassigned, isError: unassignedErr } = useOrders({ assigneeId: 'none' })
  const orders = data?.orders ?? []

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
