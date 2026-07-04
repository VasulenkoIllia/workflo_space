import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  KANBAN_COLUMNS,
  INTERNAL_STATUS_META,
  columnForStatus,
  groupByColumn,
  resolveDropStatus,
  useTransitionStatus,
  type WorkspaceOrder,
} from '@/lib/orders'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'

const overStyle = { outline: '2px dashed var(--wf-accent)', outlineOffset: 2 } as const

/** Board view of orders, grouped into active-work columns. Cards open the detail on click
 * and drag between columns to move the order through its status machine. */
export function KanbanBoard({
  orders,
  doneCount,
}: {
  orders: WorkspaceOrder[]
  doneCount?: number
}) {
  const navigate = useNavigate()
  const transition = useTransitionStatus()
  const byCol = groupByColumn(orders)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  // A finished drag fires a click on the source card in some browsers — swallow it so a
  // drop doesn't also navigate into the order.
  const suppressClick = useRef(false)

  const drop = (columnId: string, id: string) => {
    setOverCol(null)
    setDraggingId(null)
    const card = orders.find((o) => o.id === id)
    if (!card) return
    if (columnForStatus(card.internalStatus) === columnId) return // already in this column
    const target = resolveDropStatus(card.internalStatus, columnId)
    if (!target) {
      toast.error(`«${card.title}» не можна перемістити сюди`, {
        description: 'Такий перехід статусу недопустимий за робочим процесом.',
      })
      return
    }
    transition.mutate({ id, status: target })
  }

  // Drop-target props shared by the columns and the «готово» tile.
  const dropTarget = (columnId: string) => ({
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      if (!draggingId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (overCol !== columnId) setOverCol(columnId)
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      drop(columnId, e.dataTransfer.getData('text/plain') || draggingId || '')
    },
  })

  return (
    <div className="wfp-kanban">
      {KANBAN_COLUMNS.map((col) => {
        const cards = byCol[col.id] ?? []
        return (
          <div
            className="wfp-kanban-col"
            key={col.id}
            style={overCol === col.id ? overStyle : undefined}
            {...dropTarget(col.id)}
          >
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
                $ // {overCol === col.id ? 'відпустіть тут' : 'порожньо'}
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
                    draggable
                    style={{ cursor: 'grab', opacity: draggingId === card.id ? 0.4 : 1 }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', card.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggingId(card.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverCol(null)
                      suppressClick.current = true
                      setTimeout(() => (suppressClick.current = false), 0)
                    }}
                    onClick={() => {
                      if (suppressClick.current) return
                      navigate(`/orders/${card.id}`)
                    }}
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
        <div
          className="wfp-kanban-done"
          style={overCol === 'done' ? overStyle : undefined}
          {...dropTarget('done')}
        >
          <div className="wfp-kanban-done-k">// готово</div>
          <div className="wfp-kanban-done-v">{doneCount}</div>
          <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            {overCol === 'done' ? 'відпустіть — позначити готовим' : 'за весь час'}
          </div>
        </div>
      )}
    </div>
  )
}
