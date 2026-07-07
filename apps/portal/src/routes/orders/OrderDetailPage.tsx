import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrderClientStatus } from '@workflo/types'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { CLIENT_STATUS_META, PRIORITY_LABEL } from '@/lib/orders'
import {
  useActivity,
  useCommentStream,
  useDecideApproval,
  useOrder,
  type OrderDetail,
} from '@/lib/orderDetail'
import { usePortalSummary } from '@/lib/billing'
import { openDocumentPdf, useOrderDocuments, type OrderDocument } from '@/lib/documents'
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
  const [payInfo, setPayInfo] = useState(false)

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

          <Card title="Рахунок" style={{ marginBottom: 16 }}>
            <div className="wfp-side">
              <div className="wfp-side-row">
                <div className="wfp-side-k">до сплати</div>
                <div className="wfp-money-big">
                  {formatMoney(order.totalAmount)} {order.currency}
                </div>
              </div>
              <div className="wfp-side-row">
                <div className="wfp-side-k">статус</div>
                <div className="wfp-side-v">
                  {order.paidAt ? (
                    <span style={{ color: 'var(--wf-accent)' }}>Сплачено ✓</span>
                  ) : (
                    'Очікує оплати'
                  )}
                </div>
              </div>
            </div>
            {!order.paidAt && order.totalAmount != null && order.totalAmount > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPayInfo(true)}
                style={{ marginTop: 12, width: '100%' }}
              >
                Оплатити
              </Button>
            )}
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

      {payInfo && <PayInfoModal order={order} onClose={() => setPayInfo(false)} />}

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

/** 05-А: «Оплатити» → рахунок замовлення (PDF) + реквізити агенції «Як оплатити».
 * Без платіжного шлюзу — клієнт оплачує за реквізитами, оператор підтверджує вручну. */
function PayInfoModal({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const summary = usePortalSummary()
  const { data: documents } = useOrderDocuments(order.id)
  const invoice = (documents ?? []).find(
    (d: OrderDocument) =>
      (d.type === 'invoice' || d.type === 'advance_invoice') &&
      (d.status === 'sent' || d.status === 'accepted')
  )
  const ps = summary.data?.paymentSettings
  const Row = ({ k, v }: { k: string; v: string | null | undefined }) =>
    v ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
        <span style={{ color: 'var(--wf-fg-secondary)' }}>{k}</span>
        <span className="wfp-mono" style={{ textAlign: 'right' }}>
          {v}
        </span>
      </div>
    ) : null

  return (
    <Modal
      open
      onClose={onClose}
      title="Оплата замовлення"
      aux={`${formatMoney(order.totalAmount)} ${order.currency}`}
      footer={
        <Button variant="primary" onClick={onClose}>
          Зрозуміло
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {invoice ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void openDocumentPdf(order.id, invoice)}
          >
            Відкрити рахунок {invoice.number} (PDF)
          </Button>
        ) : (
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // рахунок ще не виставлено — оплатіть за реквізитами нижче
          </div>
        )}
        <div>
          <div
            className="wfp-mono"
            style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 8 }}
          >
            ЯК ОПЛАТИТИ
          </div>
          {ps ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <Row k="Отримувач" v={ps.accountName} />
              <Row k="Банк" v={ps.bankName} />
              <Row k="IBAN" v={ps.iban} />
              <Row k="USDT" v={ps.cryptoUsdt} />
              {ps.notes ? (
                <div style={{ fontSize: 12, color: 'var(--wf-fg-secondary)', marginTop: 4 }}>
                  {ps.notes}
                </div>
              ) : null}
              {!ps.bankName && !ps.iban && !ps.cryptoUsdt && (
                <div style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                  Реквізити ще не заповнені — зверніться до менеджера.
                </div>
              )}
            </div>
          ) : (
            <Skeleton style={{ height: 60 }} />
          )}
        </div>
        <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
          // після оплати статус оновиться, коли команда підтвердить надходження
        </div>
      </div>
    </Modal>
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
