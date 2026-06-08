import { useNavigate } from 'react-router-dom'
import {
  KANBAN_COLUMNS,
  INTERNAL_STATUS_META,
  groupByColumn,
  type WorkspaceOrder,
} from '@/lib/orders'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'

/** Board view of orders, grouped into active-work columns. Cards open the detail. */
export function KanbanBoard({
  orders,
  doneCount,
}: {
  orders: WorkspaceOrder[]
  doneCount?: number
}) {
  const navigate = useNavigate()
  const byCol = groupByColumn(orders)

  return (
    <div className="wfp-kanban">
      {KANBAN_COLUMNS.map((col) => {
        const cards = byCol[col.id] ?? []
        return (
          <div className="wfp-kanban-col" key={col.id}>
            <div className="wfp-kanban-col-h">
              <span className="wfp-kanban-col-t">{col.title}</span>
              <span className="wfp-kanban-col-count">{cards.length}</span>
            </div>
            <div className="wfp-kanban-col-hint">// {col.hint}</div>
            {cards.length === 0 ? (
              <div
                className="wfp-mono"
                style={{ padding: '8px 2px', fontSize: 11, color: 'var(--wf-fg-subtle)' }}
              >
                $ // порожньо
              </div>
            ) : (
              cards.map((card) => {
                const dl = deadlineMeta(card.dueDate)
                return (
                  <div
                    className="wfp-kc"
                    data-priority={card.priority}
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/orders/${card.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/orders/${card.id}`)
                      }
                    }}
                  >
                    <div className="wfp-kc-head">
                      <span className="wfp-kc-num">#{card.id.slice(0, 6)}</span>
                      {card.internalStatus && (
                        <span className="wfp-kc-client">
                          {INTERNAL_STATUS_META[card.internalStatus].label}
                        </span>
                      )}
                    </div>
                    <div className="wfp-kc-title">{card.title}</div>
                    <div className="wfp-kc-foot">
                      <span
                        className={`wfp-kc-deadline${dl.tone === 'over' ? ' wfp-kc-deadline--over' : ''}`}
                      >
                        {dl.tone === 'over' ? '⚠ ' : ''}
                        {formatDate(card.dueDate)}
                      </span>
                      <span className="wfp-kc-meta">{formatMoney(card.totalAmount)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )
      })}
      {doneCount != null && (
        <div className="wfp-kanban-done">
          <div className="wfp-kanban-done-k">// готово</div>
          <div className="wfp-kanban-done-v">{doneCount}</div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            за весь час
          </div>
        </div>
      )}
    </div>
  )
}
