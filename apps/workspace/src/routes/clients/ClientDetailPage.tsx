import { Link, useNavigate, useParams } from 'react-router-dom'
import { OrderInternalStatus } from '@workflo/types'
import { Button, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { INTERNAL_STATUS_META, useOrders } from '@/lib/orders'
import { useOrder } from '@/lib/orderDetail'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'

/** Owner — a single client (company): its orders + aggregate stats. Name resolved
 * from one order's detail (no companies endpoint yet — S5). */
export function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useOrders({ companyId: id, limit: 100 })
  const orders = data?.orders ?? []
  const firstId = orders[0]?.id ?? ''
  const { data: sample } = useOrder(firstId)
  const name = sample?.company?.name ?? `Клієнт · ${id.slice(0, 8)}`

  if (isLoading) return <Skeleton style={{ height: 280 }} />
  if (isError) {
    return (
      <EmptyState
        glyph="// error"
        title="Не вдалося завантажити клієнта"
        description="Спробуйте оновити сторінку."
      />
    )
  }

  const active = orders.filter(
    (o) =>
      o.internalStatus !== OrderInternalStatus.DONE &&
      o.internalStatus !== OrderInternalStatus.CANCELLED
  ).length
  const totalValue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0)

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">
            //{' '}
            <Link to="/clients" className="wfp-link">
              клієнти
            </Link>{' '}
            / {name}
          </div>
          <h1 className="wfp-ph-h1">{name}</h1>
        </div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 20 }}>
        <div className="wfp-stat">
          <div className="wfp-stat-k">усього замовлень</div>
          <div className="wfp-stat-v">{orders.length}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">активних</div>
          <div className="wfp-stat-v wfp-stat-v--accent">{active}</div>
        </div>
        <div className="wfp-stat">
          <div className="wfp-stat-k">сумарна вартість</div>
          <div className="wfp-stat-v">{formatMoney(totalValue)}</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Немає замовлень"
          description="У цього клієнта поки немає замовлень."
          action={
            <Link to="/clients">
              <Button variant="secondary">← До клієнтів</Button>
            </Link>
          }
        />
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Назва</th>
              <th>Статус</th>
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
      )}
    </div>
  )
}
