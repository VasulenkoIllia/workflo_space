import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrderClientStatus } from '@workflo/types'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { CLIENT_STATUS_META, PRIORITY_LABEL } from '@/lib/orders'
import { useActivity, useCommentStream, useDecideApproval, useOrder } from '@/lib/orderDetail'
import { deadlineMeta, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { ChatTab } from './ChatTab'
import { DocumentsTab } from './DocumentsTab'
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
  const decide = useDecideApproval(id)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

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
              Оцінка:{' '}
              <strong>
                {formatMoney(order.totalAmount)} {order.currency}
              </strong>
              . Погодьте, щоб команда почала роботу, або запросіть правки з коментарем.
            </div>
            {decide.isError && !rejecting && (
              <div style={{ color: 'var(--wf-destructive)', fontSize: 12, marginTop: 6 }}>
                Не вдалося — оновіть сторінку й спробуйте ще раз.
              </div>
            )}
          </div>
          <div className="wfp-approve-r">
            <Button variant="ghost" disabled={decide.isPending} onClick={() => setRejecting(true)}>
              Запросити правки
            </Button>
            <Button
              variant="primary"
              loading={decide.isPending}
              onClick={() => decide.mutate({ decision: 'approve' })}
            >
              Погодити
            </Button>
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
          {tab === 'docs' && <DocumentsTab orderId={order.id} />}
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

      {rejecting && (
        <Modal
          open
          onClose={() => setRejecting(false)}
          title="Запросити правки"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setRejecting(false)}
                disabled={decide.isPending}
              >
                Скасувати
              </Button>
              <Button
                variant="primary"
                loading={decide.isPending}
                disabled={reason.trim() === ''}
                onClick={() =>
                  decide.mutate(
                    { decision: 'reject', comment: reason.trim() },
                    {
                      onSuccess: () => {
                        setRejecting(false)
                        setReason('')
                      },
                    }
                  )
                }
              >
                Надіслати
              </Button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
              Опишіть, що змінити в оцінці — команда отримає ваш коментар і повернеться з правками.
            </div>
            <Input
              label="Коментар"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reason.trim() === '' ? 'Вкажіть, що змінити' : undefined}
            />
            {decide.isError && (
              <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
                Не вдалося надіслати — оновіть сторінку й спробуйте ще раз.
              </div>
            )}
          </div>
        </Modal>
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
