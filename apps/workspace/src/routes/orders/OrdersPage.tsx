import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState, Icon, Skeleton, StatusDot, useDebounce } from '@workflo/ui'
import {
  INTERNAL_STATUS_META,
  PRIORITY_LABEL,
  countByStatus,
  useOrders,
  type WorkspaceOrder,
} from '@/lib/orders'
import { OrderInternalStatus } from '@workflo/types'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'
import { KanbanBoard } from './KanbanBoard'

type View = 'board' | 'table'

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) === 'table' ? 'table' : 'board'
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)

  const { data, isLoading, isError } = useOrders({ search: debounced || undefined, limit: 100 })
  const orders = data?.orders ?? []
  const done = countByStatus(orders, [OrderInternalStatus.DONE])

  const setView = (v: View) => {
    const next = new URLSearchParams(params)
    if (v === 'board') next.delete('view')
    else next.set('view', v)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Замовлення</h1>
          <div className="wfp-ph-sub">// {data?.pagination.total ?? orders.length} всього</div>
        </div>
        <div className="wfp-ph-r">
          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--wf-border)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <ViewBtn label="Дошка" active={view === 'board'} onClick={() => setView('board')} />
            <ViewBtn label="Таблиця" active={view === 'table'} onClick={() => setView('table')} />
          </div>
        </div>
      </div>

      <div className="wfp-filters">
        <div className="wfp-search">
          <Icon name="search" size={14} />
          <input
            placeholder="Шукати по назві або опису…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

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
          title={debounced ? 'Нічого не знайдено' : 'Ще немає замовлень'}
          description={
            debounced
              ? 'Спробуйте інший запит.'
              : 'Замовлення зʼявляться тут, коли клієнти їх створять.'
          }
        />
      ) : (
        <>
          {data && data.pagination.total > orders.length && (
            <div
              className="wfp-mono"
              style={{ marginBottom: 12, fontSize: 11, color: 'var(--wf-fg-muted)' }}
            >
              // показано перші {orders.length} з {data.pagination.total} — уточніть пошук
              (пагінація → S10)
            </div>
          )}
          {view === 'board' ? (
            <KanbanBoard orders={orders} doneCount={done} />
          ) : (
            <OrdersTable orders={orders} />
          )}
        </>
      )}
    </div>
  )
}

function ViewBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        padding: '6px 12px',
        background: active ? 'var(--wf-fg)' : 'transparent',
        color: active ? 'var(--wf-bg)' : 'var(--wf-fg-secondary)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function OrdersTable({ orders }: { orders: WorkspaceOrder[] }) {
  const navigate = useNavigate()
  return (
    <table className="wfp-table">
      <thead>
        <tr>
          <th>№</th>
          <th>Назва</th>
          <th>Статус</th>
          <th>Пріоритет</th>
          <th>Дедлайн</th>
          <th className="wfp-num">Сума</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const meta = o.internalStatus ? INTERNAL_STATUS_META[o.internalStatus] : null
          const dl = deadlineMeta(o.dueDate)
          return (
            <tr
              key={o.id}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/orders/${o.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/orders/${o.id}`)
                }
              }}
            >
              <td className="wfp-mono">
                <span className="wfp-link">#{o.id.slice(0, 6)}</span>
              </td>
              <td>{o.title}</td>
              <td>
                {meta ? (
                  <span className="wfp-order-status">
                    <StatusDot tone={meta.tone} /> {meta.label}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td>{PRIORITY_LABEL[o.priority]}</td>
              <td
                className="wfp-mono"
                style={{ color: dl.tone === 'over' ? 'var(--wf-destructive)' : undefined }}
              >
                {formatDate(o.dueDate)}
              </td>
              <td className="wfp-num">{formatMoney(o.totalAmount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
