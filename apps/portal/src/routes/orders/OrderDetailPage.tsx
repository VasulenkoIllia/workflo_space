import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrderClientStatus } from '@workflo/types'
import { Button, Card, EmptyState, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { CLIENT_STATUS_META, PRIORITY_LABEL } from '@/lib/orders'
import { useActivity, useCommentStream, useOrder } from '@/lib/orderDetail'
import { deadlineMeta, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { ChatTab } from './ChatTab'
import { FilesTab } from './FilesTab'

const ACTIVITY_LABELS: Record<string, string> = {
  status_changed: 'змінив статус',
  'order.status_changed': 'змінив статус',
  comment_created: 'залишив коментар',
  'order.comment_created': 'залишив коментар',
  'order.file_uploaded': 'завантажив файл',
  'order.file_deleted': 'видалив файл',
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { data: order, isLoading, isError } = useOrder(id)
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
          <Link to="/orders">
            <Button variant="secondary">← До замовлень</Button>
          </Link>
        }
      />
    )
  }

  const meta = CLIENT_STATUS_META[order.clientStatus]
  const dl = deadlineMeta(order.dueDate)

  return (
    <div>
      <div className="wfp-od-header">
        <div>
          <div className="wfp-order-num" style={{ marginBottom: 6 }}>
            #{order.id.slice(0, 6)} · створено {formatDate(order.createdAt)}
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
            <span>пріоритет: {PRIORITY_LABEL[order.priority]}</span>
          </div>
        </div>
      </div>

      {order.clientStatus === OrderClientStatus.PENDING_APPROVAL && (
        <div className="wfp-approve">
          <div className="wfp-approve-l">
            <div className="wfp-approve-k">// потрібна ваша дія</div>
            <div className="wfp-approve-t">Замовлення очікує вашого погодження</div>
            <div className="wfp-approve-sub">
              Перегляньте оцінку й деталі. Щоб погодити або запросити правки — напишіть команді в
              чаті нижче.
            </div>
          </div>
        </div>
      )}

      <div className="wfp-od">
        <div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'chat', label: 'Чат' },
              { id: 'files', label: 'Файли' },
              { id: 'docs', label: 'Документи' },
            ]}
          />
          {tab === 'chat' && <ChatTab orderId={order.id} />}
          {tab === 'files' && <FilesTab orderId={order.id} />}
          {tab === 'docs' && (
            <div style={{ padding: '14px 0' }}>
              <EmptyState
                glyph="// docs"
                title="Документи зʼявляться автоматично"
                description="Специфікація, рахунок та акт генеруються після ключових подій замовлення."
              />
            </div>
          )}
        </div>

        <aside>
          {order.description != null && order.description !== '' && (
            <Card title="Опис" style={{ marginBottom: 16 }}>
              <div
                style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', whiteSpace: 'pre-wrap' }}
              >
                {order.description}
              </div>
            </Card>
          )}

          <Card title="Фінанси" style={{ marginBottom: 16 }}>
            <div className="wfp-side">
              <div className="wfp-side-row">
                <div className="wfp-side-k">оцінка</div>
                <div className="wfp-money-big">{formatMoney(order.totalAmount)}</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">валюта</div>
                <div className="wfp-side-v">{order.currency}</div>
              </div>
            </div>
          </Card>

          <Card title="Деталі" style={{ marginBottom: 16 }}>
            <div className="wfp-side">
              <div className="wfp-side-row">
                <div className="wfp-side-k">створено</div>
                <div className="wfp-side-v">{formatDate(order.createdAt)}</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">дедлайн</div>
                <div className="wfp-side-v">{formatDate(order.dueDate)}</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">пріоритет</div>
                <div className="wfp-side-v">{PRIORITY_LABEL[order.priority]}</div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">етапів</div>
                <div className="wfp-side-v">{order.stages.length}</div>
              </div>
            </div>
          </Card>

          <ActivityCard orderId={order.id} />
        </aside>
      </div>
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
