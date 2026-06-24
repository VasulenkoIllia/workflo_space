import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ALLOWED_ORDER_TRANSITIONS, OrderInternalStatus } from '@workflo/types'
import { Button, Card, EmptyState, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { INTERNAL_STATUS_META, PRIORITY_LABEL } from '@/lib/orders'
import {
  useActivity,
  useCommentStream,
  useOrder,
  useSubmitApproval,
  useTimeLogs,
  useTransitionStatus,
  type WorkspaceOrderDetail,
} from '@/lib/orderDetail'
import { deadlineMeta, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { ChatTab } from './ChatTab'
import { FilesTab } from './FilesTab'
import { TimeTab } from './TimeTab'

const ACTIVITY_LABELS: Record<string, string> = {
  status_changed: 'змінив статус',
  'order.status_changed': 'змінив статус',
  comment_created: 'залишив коментар',
  'order.comment_created': 'залишив коментар',
  'order.file_uploaded': 'завантажив файл',
  'order.file_deleted': 'видалив файл',
  'order.assigned': 'призначив виконавця',
  'order.time_logged': 'залогував час',
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { data: order, isLoading, isError } = useOrder(id)
  const { data: timeData } = useTimeLogs(id)
  useCommentStream(id) // keep live chat updates flowing regardless of the active tab
  const [tab, setTab] = useState('chat')

  if (isLoading) return <DetailSkeleton />
  if (isError || !order) {
    return (
      <EmptyState
        glyph="// 404"
        title="Замовлення не знайдено"
        description="Можливо, його видалили або у вас немає доступу."
        action={
          <Link to="/">
            <Button variant="secondary">← На головну</Button>
          </Link>
        }
      />
    )
  }

  const meta = INTERNAL_STATUS_META[order.internalStatus]
  const dl = deadlineMeta(order.dueDate)
  const logged = timeData?.totalHours ?? 0

  return (
    <div>
      <div className="wfp-od-header">
        <div>
          <div className="wfp-order-num" style={{ marginBottom: 6 }}>
            #{order.id.slice(0, 6)}
            {order.company ? ` · ${order.company.name}` : ''} · створено{' '}
            {formatDate(order.createdAt)}
          </div>
          <h1 className="wfp-od-h1">{order.title}</h1>
          <div className="wfp-od-meta">
            <span className="wfp-order-status">
              <StatusDot tone={meta.tone} /> {meta.label}
            </span>
            <span>·</span>
            <span>
              дедлайн:{' '}
              <span
                style={{ color: dl.tone === 'over' ? 'var(--wf-destructive)' : 'var(--wf-fg)' }}
              >
                {formatDate(order.dueDate)}
              </span>
            </span>
            <span>·</span>
            <span>
              оцінка:{' '}
              <span style={{ color: 'var(--wf-fg)' }}>{formatMoney(order.totalAmount)}</span>
            </span>
            <span>·</span>
            <span>лог: {logged} год</span>
          </div>
        </div>
        <StatusControl orderId={order.id} current={order.internalStatus} />
      </div>

      <div className="wfp-od">
        <div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'chat', label: 'Чат' },
              { id: 'files', label: 'Файли' },
              { id: 'time', label: 'Час' },
            ]}
          />
          {tab === 'chat' && <ChatTab orderId={order.id} />}
          {tab === 'files' && <FilesTab orderId={order.id} />}
          {tab === 'time' && <TimeTab orderId={order.id} />}
        </div>

        <aside>
          {order.company && (
            <Card title="Клієнт" style={{ marginBottom: 16 }}>
              <div className="wfp-side">
                <div className="wfp-side-row">
                  <div className="wfp-side-k">компанія</div>
                  <div className="wfp-side-v">{order.company.name}</div>
                </div>
              </div>
            </Card>
          )}

          <ApprovalCard order={order} />

          <Card title="Фінанси" style={{ marginBottom: 16 }}>
            <div className="wfp-side">
              <div className="wfp-side-row">
                <div className="wfp-side-k">оцінка</div>
                <div className="wfp-money-big">{formatMoney(order.totalAmount)}</div>
              </div>
              {order.billingType && (
                <div className="wfp-side-row">
                  <div className="wfp-side-k">тип</div>
                  <div className="wfp-side-v">{order.billingType}</div>
                </div>
              )}
              <div className="wfp-side-row">
                <div className="wfp-side-k">валюта</div>
                <div className="wfp-side-v">{order.currency}</div>
              </div>
              {order.paidAt && (
                <div className="wfp-side-row">
                  <div className="wfp-side-k">оплачено</div>
                  <div className="wfp-side-v">{formatDate(order.paidAt)}</div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Деталі" style={{ marginBottom: 16 }}>
            <div className="wfp-side">
              <div className="wfp-side-row">
                <div className="wfp-side-k">виконавець</div>
                <div className="wfp-side-v">{order.assignee?.name ?? '—'}</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">пріоритет</div>
                <div className="wfp-side-v">{PRIORITY_LABEL[order.priority]}</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">залоговано</div>
                <div className="wfp-side-v">{logged} год</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">етапів</div>
                <div className="wfp-side-v">{order.stages.length}</div>
              </div>
            </div>
            {order.onHoldReason && (
              <div
                style={{ marginTop: 12, fontSize: 12, color: 'var(--wf-warning)' }}
                className="wfp-mono"
              >
                // пауза: {order.onHoldReason}
              </div>
            )}
          </Card>

          <ActivityCard orderId={order.id} />
        </aside>
      </div>
    </div>
  )
}

/** Status transition control — offers only the transitions the state machine allows. */
/** Pre-work states from which an estimate may be sent to the client (02-А). */
const SUBMITTABLE_STATUSES: OrderInternalStatus[] = [
  OrderInternalStatus.NEW,
  OrderInternalStatus.CLARIFICATION,
  OrderInternalStatus.ESTIMATING,
]

/** Team-side estimate-approval control: submit for client approval, or show the current state. */
function ApprovalCard({ order }: { order: WorkspaceOrderDetail }) {
  const submit = useSubmitApproval(order.id)
  const hasEstimate =
    (order.fixedPrice != null && order.fixedPrice > 0) ||
    (order.hourlyRate != null && order.estimatedHours != null)
  const submittable = SUBMITTABLE_STATUSES.includes(order.internalStatus)

  if (order.approvalStatus === 'pending') {
    return (
      <Card title="Погодження" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <StatusDot tone="warning" /> Очікує погодження клієнта
        </div>
      </Card>
    )
  }
  if (order.approvalStatus === 'approved') {
    return (
      <Card title="Погодження" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <StatusDot tone="success" /> Клієнт погодив оцінку
        </div>
      </Card>
    )
  }
  // rejected (re-submit allowed) or never submitted — only meaningful before work starts.
  if (!submittable) return null
  return (
    <Card title="Погодження" style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        {order.approvalStatus === 'rejected' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <StatusDot tone="muted" /> Клієнт запросив правки
          </div>
        )}
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          // надіслати оцінку клієнту на погодження (02-А)
        </div>
        {hasEstimate ? (
          <Button
            variant="primary"
            size="sm"
            loading={submit.isPending}
            onClick={() => submit.mutate(undefined)}
          >
            {order.approvalStatus === 'rejected' ? 'Надіслати ще раз' : 'Надіслати на погодження'}
          </Button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            Спершу виставте оцінку (суму або ставку + години).
          </div>
        )}
        {submit.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
            Не вдалося надіслати — перевірте стан замовлення.
          </div>
        )}
      </div>
    </Card>
  )
}

function StatusControl({ orderId, current }: { orderId: string; current: OrderInternalStatus }) {
  const transition = useTransitionStatus(orderId)
  const [target, setTarget] = useState<OrderInternalStatus | ''>('')
  const [reason, setReason] = useState('')
  const options = ALLOWED_ORDER_TRANSITIONS[current] ?? []
  // Pausing / cancelling should carry a reason (→ onHoldReason / cancelledReason).
  const needsReason =
    target === OrderInternalStatus.ON_HOLD || target === OrderInternalStatus.CANCELLED
  const reasonInvalid = needsReason && reason.trim() === ''

  const apply = () => {
    if (!target || reasonInvalid) return
    transition.mutate(
      { status: target, comment: needsReason ? reason.trim() : undefined },
      {
        onSuccess: () => {
          toast.success(`Статус → ${INTERNAL_STATUS_META[target].label}`)
          setTarget('')
          setReason('')
        },
      }
    )
  }

  if (options.length === 0) {
    return (
      <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        // фінальний статус
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={target}
          onChange={(e) => {
            const v = e.target.value
            // Only the real options come from the state machine; '' is the placeholder.
            setTarget(v === '' ? '' : (v as OrderInternalStatus))
          }}
          style={{
            minWidth: 160,
            height: 36,
            padding: '0 10px',
            borderRadius: 6,
            border: '1px solid var(--wf-border)',
            background: 'var(--wf-bg)',
            color: 'var(--wf-fg)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
          }}
        >
          <option value="">Змінити статус…</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {INTERNAL_STATUS_META[s].label}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          disabled={!target || reasonInvalid}
          loading={transition.isPending}
          onClick={apply}
        >
          Застосувати
        </Button>
      </div>
      {needsReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            target === OrderInternalStatus.CANCELLED ? 'Причина скасування…' : 'Причина паузи…'
          }
          style={{
            height: 34,
            padding: '0 10px',
            borderRadius: 6,
            border: `1px solid ${reasonInvalid ? 'var(--wf-destructive)' : 'var(--wf-border)'}`,
            background: 'var(--wf-bg)',
            color: 'var(--wf-fg)',
            fontSize: 13,
          }}
        />
      )}
    </div>
  )
}

function ActivityCard({ orderId }: { orderId: string }) {
  const { data: activity = [] } = useActivity(orderId)
  return (
    <Card title="Activity" aux="останні">
      {activity.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // поки порожньо
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activity.slice(0, 6).map((a) => (
            <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}>
                {formatDateTime(a.createdAt)}
              </span>
              <span style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--wf-accent)' }}>{a.actor.name}</span> ·{' '}
                {ACTIVITY_LABELS[a.action] ?? a.action}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Skeleton variant="line" style={{ width: 180, marginBottom: 10 }} />
        <Skeleton variant="title" style={{ width: '50%' }} />
      </div>
      <div className="wfp-od">
        <Skeleton style={{ height: 320 }} />
        <Skeleton style={{ height: 220 }} />
      </div>
    </div>
  )
}
