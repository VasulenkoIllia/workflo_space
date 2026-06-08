import { OrderInternalStatus } from '@workflo/types'
import { EmptyState, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useOrders, countByStatus } from '@/lib/orders'
import { KanbanBoard } from '@/routes/orders/KanbanBoard'

/** Executor home — a personal kanban of the tasks assigned to me. */
export function DashboardPage() {
  const { user } = useAuth()
  const myId = user?.profile.id ?? ''
  const { data, isLoading, isError } = useOrders({ assigneeId: myId })
  const orders = data?.orders ?? []

  const inProgress = countByStatus(orders, [
    OrderInternalStatus.IN_PROGRESS,
    OrderInternalStatus.REVISION,
  ])
  const review = countByStatus(orders, [OrderInternalStatus.REVIEW])
  const queue = countByStatus(orders, [
    OrderInternalStatus.NEW,
    OrderInternalStatus.CLARIFICATION,
    OrderInternalStatus.ESTIMATING,
  ])
  const done = countByStatus(orders, [OrderInternalStatus.DONE])

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Мої задачі</h1>
          <div className="wfp-ph-sub">// {orders.length} призначено вам</div>
        </div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">в роботі</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{inProgress}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">на рев’ю</div>
          <div className="wfp-stat-v wfp-stat-v--warn">{review}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">у черзі</div>
          <div className="wfp-stat-v">{queue}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">завершено</div>
          <div className="wfp-stat-v">{done}</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : isError ? (
        <EmptyState
          glyph="// error"
          title="Не вдалося завантажити задачі"
          description="Спробуйте оновити сторінку."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Поки немає призначених задач"
          description="Коли вам призначать замовлення, воно зʼявиться тут."
        />
      ) : (
        <KanbanBoard orders={orders} doneCount={done} />
      )}
    </div>
  )
}
