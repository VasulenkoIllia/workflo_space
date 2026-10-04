import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { OrderClientStatus } from '@workflo/types'
import { Button, EmptyState, Icon, Skeleton, StatusDot, cn, useDebounce } from '@workflo/ui'
import { CLIENT_STATUS_META, PRIORITY_LABEL, useOrders, type PortalOrder } from '@/lib/orders'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'

const FILTERS: { id: 'all' | OrderClientStatus; label: string }[] = [
  { id: 'all', label: 'всі' },
  { id: OrderClientStatus.IN_PROGRESS, label: 'в роботі' },
  { id: OrderClientStatus.PENDING_APPROVAL, label: 'очікують' },
  { id: OrderClientStatus.COMPLETED, label: 'готово' },
]

const VALID_STATUS = new Set<string>(FILTERS.map((f) => f.id))

export function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status =
    statusParam != null && statusParam !== 'all' && VALID_STATUS.has(statusParam)
      ? (statusParam as OrderClientStatus)
      : undefined

  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)

  const { data, isLoading, isError, refetch } = useOrders({ status, search: search || undefined })
  const orders = data?.orders ?? []
  const total = data?.pagination.total ?? 0

  // Per-status counts reflect the loaded page (limit 50); "всього" uses pagination.total.
  // Accurate for typical small order counts — a per-status API aggregate is the proper fix later.
  const counts = orders.reduce<Partial<Record<OrderClientStatus, number>>>((acc, o) => {
    acc[o.clientStatus] = (acc[o.clientStatus] ?? 0) + 1
    return acc
  }, {})

  const setFilter = (id: 'all' | OrderClientStatus) => {
    const p = new URLSearchParams(params)
    if (id === 'all') p.delete('status')
    else p.set('status', id)
    setParams(p, { replace: true })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Замовлення</div>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // {total} всього
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icon name="plus" size={14} />}
          onClick={() => navigate('/orders/new')}
        >
          Нове замовлення
        </Button>
      </div>

      <div className="wfp-stats">
        <Stat k="всього" v={total} />
        <Stat k="в роботі" v={counts[OrderClientStatus.IN_PROGRESS] ?? 0} tone="accent" />
        <Stat k="очікують дії" v={counts[OrderClientStatus.PENDING_APPROVAL] ?? 0} tone="warn" />
        <Stat k="готово" v={counts[OrderClientStatus.COMPLETED] ?? 0} />
      </div>

      <div className="wfp-filters">
        <div className="wfp-search">
          <Icon name="search" size={15} />
          <input
            placeholder="Шукати замовлення…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="wfp-pill"
            data-on={(f.id === 'all' ? status == null : status === f.id) || undefined}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="wfp-orders">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="wfp-order-row" style={{ cursor: 'default' }}>
              <Skeleton variant="line" style={{ width: 64 }} />
              <Skeleton variant="line" style={{ width: '55%' }} />
              <Skeleton variant="line" style={{ width: 80 }} />
              <Skeleton variant="line" style={{ width: 56 }} />
              <Skeleton variant="line" style={{ width: 56 }} />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          glyph="// 500"
          title="Не вдалося завантажити"
          description="Сталася помилка під час завантаження замовлень."
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              Спробувати ще раз
            </Button>
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title={status != null || search ? 'Нічого не знайдено' : 'Замовлень ще немає'}
          description={
            status != null || search
              ? 'Спробуйте змінити фільтри або пошук.'
              : '// тут зʼявляться ваші замовлення'
          }
        />
      ) : (
        <div className="wfp-orders">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} onOpen={() => navigate(`/orders/${o.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ k, v, tone }: { k: string; v: number; tone?: 'accent' | 'warn' }) {
  return (
    <div className="wfp-stat">
      <span className="wfp-stat-k">{k}</span>
      <span
        className={cn(
          'wfp-stat-v',
          tone === 'accent' && 'wfp-stat-v--accent',
          tone === 'warn' && 'wfp-stat-v--warn'
        )}
      >
        {v}
      </span>
    </div>
  )
}

function OrderRow({ order, onOpen }: { order: PortalOrder; onOpen: () => void }) {
  const meta = CLIENT_STATUS_META[order.clientStatus]
  const dl = deadlineMeta(order.dueDate)
  return (
    <div
      className="wfp-order-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="wfp-order-num">#{order.id.slice(0, 6)}</div>
      <div className="wfp-order-title">
        <div className="wfp-order-title-t">{order.title}</div>
        <div className="wfp-order-title-m">
          <span>{PRIORITY_LABEL[order.priority]}</span>
          <span>·</span>
          <span>{order.stageCount} етап.</span>
        </div>
      </div>
      <span className="wfp-order-status">
        <StatusDot tone={meta.tone} /> {meta.label}
      </span>
      <div className="wfp-order-money">
        <span>{formatMoney(order.totalAmount)}</span>
      </div>
      <div
        className={cn(
          'wfp-order-deadline',
          dl.tone === 'over' && 'wfp-order-deadline--over',
          dl.tone === 'soon' && 'wfp-order-deadline--soon'
        )}
      >
        <span>{formatDate(order.dueDate)}</span>
        <span className="wfp-order-deadline-sub">{dl.label}</span>
      </div>
    </div>
  )
}
