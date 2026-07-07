import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { type BoardTask, type TaskStatus, useAllTasks, useMoveBoardTask } from '@/lib/tasks'

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'До роботи' },
  { id: 'in_progress', label: 'В роботі' },
  { id: 'done', label: 'Готово' },
]

/** Est-vs-actual mini-bar of the card's ORDER (годин на задачі нема — rollup у замовлення,
 * канон workspace-board-task.jsx). Без оцінки → лише факт годин; без годин узагалі → нічого. */
function OrderHoursBar({ order }: { order: BoardTask['order'] }) {
  const { estimatedHours: est, loggedHours: logged } = order
  if (est == null || est <= 0) {
    if (logged <= 0) return null
    return (
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        {logged} год · без оцінки
      </div>
    )
  }
  const pct = (logged / est) * 100
  const over = pct > 100
  return (
    <div
      style={{ marginTop: 6 }}
      title={`Замовлення: ${logged} з ${est} год (${Math.round(pct)}%)`}
    >
      <div
        className="wfp-mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--wf-fg-muted)',
          marginBottom: 3,
        }}
      >
        <span>
          {logged}/{est} год
        </span>
        <span style={over ? { color: 'var(--wf-destructive)' } : undefined}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="wfp-est-bar" style={{ height: 3 }}>
        <div
          className={`wfp-est-bar-fill${over ? ' wfp-est-bar-fill--over' : ''}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

/** Global task board (02-Е / workspace-board.jsx, фінд.#8) — every internal task across the
 * agency's orders, grouped by status. Drag a card between columns to move it (reuses the
 * per-order PATCH). Filter to «мої». */
export function TaskBoardPage() {
  const { user } = useAuth()
  const myId = user?.profile.id
  const [mine, setMine] = useState(false)
  const { data, isLoading } = useAllTasks(mine && myId ? { assigneeId: myId } : {})
  const move = useMoveBoardTask()
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)

  const tasks = data?.tasks ?? []
  const byCol = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  const drop = (status: TaskStatus, t: BoardTask) => {
    setOverCol(null)
    if (t.status === status) return
    move.mutate({ orderId: t.order.id, id: t.id, status })
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// задачі команди · усі замовлення</div>
          <h1 className="wfp-ph-h1">Дошка задач</h1>
        </div>
        <div className="wfp-ph-r">
          <button
            type="button"
            className="wfp-link wfp-mono"
            style={{ fontSize: 12 }}
            onClick={() => setMine((v) => !v)}
          >
            {mine ? '← усі задачі' : 'лише мої →'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : tasks.length === 0 ? (
        <EmptyState
          title={mine ? 'У вас немає задач' : 'Задач ще немає'}
          description="Задачі створюються в деталі замовлення (таб «Задачі»)."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e: DragEvent) => {
                e.preventDefault()
                setOverCol(col.id)
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e: DragEvent) => {
                const id = e.dataTransfer.getData('text/plain')
                const t = tasks.find((x) => x.id === id)
                if (t) drop(col.id, t)
              }}
              style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: 10,
                minHeight: 120,
                ...(overCol === col.id ? { outline: '2px dashed var(--wf-accent)' } : {}),
              }}
            >
              <div
                className="wfp-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--wf-fg-muted)',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{col.label}</span>
                <span>{byCol(col.id).length}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {byCol(col.id).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/plain', t.id)}
                    style={{
                      background: 'var(--wf-bg)',
                      border: '1px solid var(--wf-border)',
                      borderRadius: 'var(--wf-radius)',
                      padding: '8px 10px',
                      cursor: 'grab',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t.title}</div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Link
                        to={`/orders/${t.order.id}`}
                        className="wfp-link wfp-mono"
                        style={{
                          fontSize: 11,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.order.title}
                      </Link>
                      <span
                        className="wfp-mono"
                        title={[t.assignee?.name, ...(t.coAssignees ?? []).map((c) => c.name)]
                          .filter(Boolean)
                          .join(', ')}
                        style={{ fontSize: 11, color: 'var(--wf-fg-subtle)', flexShrink: 0 }}
                      >
                        {t.assignee?.name ?? '—'}
                        {(t.coAssignees?.length ?? 0) > 0 && (
                          <span style={{ color: 'var(--wf-accent)' }}>
                            {' '}
                            +{t.coAssignees?.length}
                          </span>
                        )}
                      </span>
                    </div>
                    <OrderHoursBar order={t.order} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
