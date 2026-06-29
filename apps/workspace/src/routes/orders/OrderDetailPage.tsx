import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ALLOWED_ORDER_TRANSITIONS, BillingType, OrderInternalStatus } from '@workflo/types'
import { Button, Card, EmptyState, Input, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import { INTERNAL_STATUS_META, PRIORITY_LABEL } from '@/lib/orders'
import { useProjectEstimate } from '@/lib/projects'
import {
  useActivity,
  useCommentStream,
  useOrder,
  useSubmitApproval,
  useTimeLogs,
  useTransitionStatus,
  useUpdateOrder,
  type UpdateOrderInput,
  type WorkspaceOrderDetail,
} from '@/lib/orderDetail'
import { deadlineMeta, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { ChatTab } from './ChatTab'
import { DocumentsTab } from './DocumentsTab'
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

      {order.estimatedHours != null && order.estimatedHours > 0 && (
        <EstimateProgress logged={logged} estimated={order.estimatedHours} />
      )}

      <div className="wfp-od">
        <div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'chat', label: 'Чат' },
              { id: 'time', label: 'Час' },
              { id: 'spec', label: 'Специфікація' },
              { id: 'files', label: 'Файли' },
              { id: 'docs', label: 'Документи' },
            ]}
          />
          {tab === 'chat' && <ChatTab orderId={order.id} />}
          {tab === 'time' && <TimeTab orderId={order.id} />}
          {tab === 'spec' && <SpecTab project={order.project} />}
          {tab === 'files' && <FilesTab orderId={order.id} />}
          {tab === 'docs' && <DocumentsTab orderId={order.id} />}
        </div>

        <aside>
          {order.company && (
            <Card title="Клієнт" style={{ marginBottom: 16 }}>
              <div className="wfp-side">
                <div className="wfp-side-row">
                  <div className="wfp-side-k">компанія</div>
                  <div className="wfp-side-v">{order.company.name}</div>
                </div>
                {order.project && (
                  <div className="wfp-side-row">
                    <div className="wfp-side-k">проєкт</div>
                    <div className="wfp-side-v">
                      <Link to={`/projects/${order.project.id}`} className="wfp-link">
                        {order.project.name}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <EstimateCard order={order} />

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

/** Специфікація tab (02-Б, P-6): the order's project estimate — spec lines + reconciliation
 * vs the subscription hour cap. Estimate lives at the project level (internal-non-manager). */
function SpecTab({ project }: { project?: WorkspaceOrderDetail['project'] }) {
  const { isManager } = useAuth()
  const { data: est, isLoading, isError } = useProjectEstimate(project?.id, !isManager)

  if (!project) {
    return (
      <EmptyState
        title="Без проєкту"
        description="Замовлення не привʼязане до фін-проєкту — специфікація ведеться на рівні проєкту."
      />
    )
  }
  if (isManager) {
    return (
      <EmptyState
        title="Немає доступу"
        description="Специфікація доступна власнику та виконавцям."
      />
    )
  }
  if (isLoading) return <Skeleton style={{ height: 160 }} />
  if (isError || !est) {
    return (
      <EmptyState title="Не вдалося завантажити специфікацію" description="Спробуйте оновити." />
    )
  }

  return (
    <Card
      title="Специфікація"
      aux={`${est.totalHours} год`}
      actions={
        <Link to={`/projects/${project.id}`} className="wfp-link wfp-mono" style={{ fontSize: 12 }}>
          проєкт →
        </Link>
      }
    >
      {est.includedHoursCap != null && (
        <div
          className="wfp-mono"
          style={{
            fontSize: 12,
            marginBottom: 12,
            color: est.withinCap ? 'var(--wf-fg-muted)' : 'var(--wf-destructive)',
          }}
        >
          {est.totalHours} / {est.includedHoursCap} год включено
          {est.remainingHours != null &&
            (est.withinCap
              ? ` · залишок ${est.remainingHours}`
              : ` · перевищення ${est.remainingHours.replace('-', '')}`)}
        </div>
      )}
      {est.lines.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // специфікацію ще не складено — додайте рядки на екрані проєкту
        </div>
      ) : (
        <table className="wfp-table">
          <thead>
            <tr>
              <th>Послуга</th>
              <th className="wfp-num">Години</th>
              <th className="wfp-num">Сума</th>
            </tr>
          </thead>
          <tbody>
            {est.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="wfp-num">{Number(l.hours)}</td>
                <td className="wfp-num">
                  {l.amount != null ? formatMoney(Number(l.amount)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/** Status transition control — offers only the transitions the state machine allows. */
/** Pre-work states from which an estimate may be sent to the client (02-А). */
const SUBMITTABLE_STATUSES: OrderInternalStatus[] = [
  OrderInternalStatus.NEW,
  OrderInternalStatus.CLARIFICATION,
  OrderInternalStatus.ESTIMATING,
]

/** Estimate-vs-actual bar (design «PROGRESS · ESTIMATE VS ACTUAL»): logged hours against the
 * estimate, with an 80% tick and an over-budget alert. Only for hourly-estimated orders. */
function EstimateProgress({ logged, estimated }: { logged: number; estimated: number }) {
  const pct = Math.round((logged / estimated) * 100)
  const over = pct > 100
  const warn = pct >= 80 && !over
  const remaining = Math.max(0, estimated - logged)
  const tone = over ? 'var(--wf-destructive)' : warn ? 'var(--wf-warning)' : 'var(--wf-accent)'
  return (
    <div style={{ margin: '0 0 18px' }}>
      <div
        className="wfp-mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--wf-fg-muted)',
          marginBottom: 6,
        }}
      >
        <span>// estimate vs actual</span>
        <span>
          {logged} год / {estimated} год · {pct}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--wf-border)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: tone }} />
        <div
          style={{
            position: 'absolute',
            inset: '0 auto 0 80%',
            width: 1,
            background: 'var(--wf-fg-subtle)',
          }}
        />
      </div>
      <div
        className="wfp-mono"
        style={{
          fontSize: 11,
          marginTop: 6,
          color: over ? 'var(--wf-destructive)' : 'var(--wf-fg-muted)',
        }}
      >
        {over
          ? `⚠ перевищення на ${pct - 100}% (${(logged - estimated).toFixed(1)} год понад оцінку)`
          : `залишок: ${remaining.toFixed(1)} год`}
      </div>
    </div>
  )
}

/** Pre-approval estimate editor: fixed sum, or hourly rate × hours. Hidden once approval is
 * pending/approved (billing is locked server-side) or the order has left pre-work. */
function EstimateCard({ order }: { order: WorkspaceOrderDetail }) {
  const update = useUpdateOrder(order.id)
  const [mode, setMode] = useState<BillingType>(
    order.hourlyRate != null && order.estimatedHours != null
      ? BillingType.HOURLY
      : BillingType.FIXED
  )
  const [fixed, setFixed] = useState(order.fixedPrice != null ? String(order.fixedPrice) : '')
  const [rate, setRate] = useState(order.hourlyRate != null ? String(order.hourlyRate) : '')
  const [hours, setHours] = useState(
    order.estimatedHours != null ? String(order.estimatedHours) : ''
  )

  // The team may price the order until the client's approval is pending/approved (server-
  // enforced) and while it's still live — so an order that reached in-progress/review WITHOUT an
  // estimate can still get one (not only in the pre-work states).
  const editable =
    order.internalStatus !== OrderInternalStatus.DONE &&
    order.internalStatus !== OrderInternalStatus.CANCELLED &&
    order.approvalStatus !== 'pending' &&
    order.approvalStatus !== 'approved'
  if (!editable) return null

  const num = (s: string) => {
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const r = num(rate)
  const h = num(hours)
  const valid = mode === BillingType.FIXED ? num(fixed) != null : r != null && h != null
  const preview = mode === BillingType.HOURLY && r != null && h != null ? r * h : null

  const save = () => {
    if (!valid) return
    const body: UpdateOrderInput =
      mode === BillingType.FIXED
        ? {
            billingType: BillingType.FIXED,
            fixedPrice: num(fixed),
            hourlyRate: null,
            estimatedHours: null,
          }
        : { billingType: BillingType.HOURLY, hourlyRate: r, estimatedHours: h, fixedPrice: null }
    const canSubmit = SUBMITTABLE_STATUSES.includes(order.internalStatus)
    update.mutate(body, {
      onSuccess: () =>
        toast.success(
          canSubmit ? 'Оцінку збережено — можна надіслати на погодження' : 'Оцінку збережено'
        ),
      onError: (e) =>
        toast.error('Не вдалося зберегти оцінку', {
          description: e instanceof Error ? e.message : undefined,
        }),
    })
  }

  return (
    <Card title="Оцінка" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <ModeBtn
          label="Фіксована"
          active={mode === BillingType.FIXED}
          onClick={() => setMode(BillingType.FIXED)}
        />
        <ModeBtn
          label="Погодинна"
          active={mode === BillingType.HOURLY}
          onClick={() => setMode(BillingType.HOURLY)}
        />
      </div>
      {mode === BillingType.FIXED ? (
        <Input
          label={`Сума, ${order.currency}`}
          inputMode="decimal"
          value={fixed}
          onChange={(e) => setFixed(e.target.value)}
          placeholder="напр. 1200"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input
            label={`Ставка/год, ${order.currency}`}
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="50"
          />
          <Input
            label="Годин"
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="24"
          />
        </div>
      )}
      {preview != null && (
        <div
          className="wfp-mono"
          style={{ fontSize: 12, color: 'var(--wf-fg-muted)', marginTop: 8 }}
        >
          // разом ≈ {Math.round(preview)} {order.currency}
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        loading={update.isPending}
        disabled={!valid}
        onClick={save}
        style={{ marginTop: 12 }}
      >
        Зберегти оцінку
      </Button>
    </Card>
  )
}

function ModeBtn({
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
      className="wfp-mono"
      style={{
        fontSize: 11,
        padding: '4px 10px',
        borderRadius: 999,
        cursor: 'pointer',
        border: '1px solid var(--wf-border)',
        background: active
          ? 'color-mix(in oklab, var(--wf-accent) 14%, transparent)'
          : 'transparent',
        color: active ? 'var(--wf-fg)' : 'var(--wf-fg-muted)',
      }}
    >
      {label}
    </button>
  )
}

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
