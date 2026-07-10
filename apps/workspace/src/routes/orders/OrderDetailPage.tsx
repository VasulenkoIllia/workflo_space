import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ALLOWED_ORDER_TRANSITIONS, BillingType, OrderInternalStatus } from '@workflo/types'
import { Button, Card, EmptyState, Input, Skeleton, StatusDot, Tabs } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import {
  useNomenclature,
  useOrderEstimate,
  useSaveOrderEstimate,
  type OrderEstimateLine,
} from '@/lib/nomenclature'
import { useServices } from '@/lib/services'
import { INTERNAL_STATUS_META, PRIORITY_LABEL } from '@/lib/orders'
import { useProjectEstimate } from '@/lib/projects'
import {
  useActivity,
  useCommentStream,
  useOrder,
  useReconcileOrder,
  useSetOrderCoAssignees,
  useSubmitApproval,
  useTimeLogs,
  useTransitionStatus,
  useUpdateOrder,
  type UpdateOrderInput,
  type WorkspaceOrderDetail,
} from '@/lib/orderDetail'
import { useTeam } from '@/lib/payouts'
import { deadlineMeta, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { ChatTab } from './ChatTab'
import { useOrderTags, useSetOrderTags, type OrderTag } from '@/lib/orders'
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
          {tab === 'spec' && (
            <SpecTab
              project={order.project}
              orderId={order.id}
              estimateEditable={
                order.internalStatus !== OrderInternalStatus.DONE &&
                order.internalStatus !== OrderInternalStatus.CANCELLED &&
                order.approvalStatus !== 'pending' &&
                order.approvalStatus !== 'approved'
              }
            />
          )}
          {tab === 'files' && <FilesTab orderId={order.id} />}
          {tab === 'docs' && <DocumentsTab orderId={order.id} />}
        </div>

        <aside>
          <SlaCard order={order} />
          <AcceptanceCard order={order} />
          <OrderExecutorsCard
            orderId={order.id}
            primary={order.assignee ?? null}
            coAssignees={order.coAssignees ?? []}
          />
          <OrderTagsCard orderId={order.id} current={order.tags ?? []} />
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
function SpecTab({
  project,
  orderId,
  estimateEditable,
}: {
  project?: WorkspaceOrderDetail['project']
  orderId: string
  estimateEditable: boolean
}) {
  const { isManager } = useAuth()
  const { data: est, isLoading, isError } = useProjectEstimate(project?.id, !isManager)

  if (!project) {
    // 02-Б: разове замовлення — кошторис к-сть × ціна прямо тут (Σ → сума замовлення)
    if (isManager) {
      return (
        <EmptyState
          title="Немає доступу"
          description="Специфікація доступна власнику та виконавцям."
        />
      )
    }
    return <OrderEstimateEditor orderId={orderId} editable={estimateEditable} />
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

      {/* 02-Б: номенклатура «згідно КВЕД» — саме її назва друкується в рахунках/актах */}
      <NomenclaturePicker
        value={order.nomenclatureId ?? null}
        onChange={(nomenclatureId) =>
          update.mutate({ nomenclatureId } as UpdateOrderInput, {
            onSuccess: () => toast.success('Номенклатуру збережено'),
          })
        }
        disabled={update.isPending}
      />
    </Card>
  )
}

/** 02-Б: селект офіційної позиції для рахунків/актів (довідник — /settings). */
function NomenclaturePicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const { data } = useNomenclature()
  const items = (data?.items ?? []).filter((n) => n.isActive || n.id === value)
  return (
    <div style={{ marginTop: 14 }}>
      <div
        className="wfp-mono"
        style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginBottom: 6 }}
      >
        НОМЕНКЛАТУРА (друкується в рахунках/актах)
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        style={{
          width: '100%',
          background: 'var(--wf-surface)',
          color: 'var(--wf-fg)',
          border: '1px solid var(--wf-border)',
          borderRadius: 'var(--wf-radius)',
          padding: '8px 10px',
          fontSize: 13,
        }}
      >
        <option value="">— не задано (друкується назва замовлення) —</option>
        {items.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
            {n.code ? ` · ${n.code}` : ''}
          </option>
        ))}
      </select>
      {items.length === 0 && (
        <div
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 4 }}
        >
          // довідник порожній — власник додає позиції в Налаштуваннях
        </div>
      )}
    </div>
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

/** S10-01: теги замовлення — чіпи + чек-пікер з каталогу агенції (replace-set). */
const HRS = (n: number | null | undefined): string =>
  n == null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)} год`

/**
 * ПРИЙМАННЯ РОБОТИ (07.07): виконавець здає (in_progress→review), owner/manager приймає
 * (review→done). Показує 4 числа — План / Факт (Σ TimeLog, не редагується) / Білабельно
 * (клієнту) / До-оплати (виконавцям) + per-executor розбивку. Ростер звірки = ВСІ причетні
 * (співвиконавці замовлення + виконавці задач замовлення), тож owner може розподілити оплату
 * на будь-кого залученого, а не лише на тих, хто залогував час. Owner/manager у статусі review
 * коригує білабельні + оплатні години й приймає або повертає на доопрацювання.
 */
function AcceptanceCard({ order }: { order: WorkspaceOrderDetail }) {
  const a = order.acceptance
  const { isOwner, isManager, isExecutor } = useAuth()
  const isAcceptor = isOwner || isManager
  const transition = useTransitionStatus(order.id)
  const reconcile = useReconcileOrder(order.id)
  const [editing, setEditing] = useState(false)
  const [billable, setBillable] = useState('')
  const [payable, setPayable] = useState<Record<string, string>>({})
  const [sendBack, setSendBack] = useState<string | null>(null)
  if (!a) return null

  const status = order.internalStatus
  const hourly = order.billingType === BillingType.HOURLY
  const inReview = status === OrderInternalStatus.REVIEW
  const accepted = status === OrderInternalStatus.DONE
  const payableTotal = a.executors.reduce((s, e) => s + e.payableHours, 0)
  // Ростер тепер = всі причетні (співвиконавці замовлення + виконавці задач), навіть без факту.
  // У перегляді ховаємо «0 → 0» (не засмічуємо), у редагуванні показуємо всіх для розподілу.
  const rosterView = editing
    ? a.executors
    : a.executors.filter((e) => e.trackedHours > 0 || e.payableHours > 0)

  const startEdit = () => {
    setBillable(a.billableHours != null ? String(a.billableHours) : '')
    setPayable(Object.fromEntries(a.executors.map((e) => [e.profileId, String(e.payableHours)])))
    setEditing(true)
  }
  const saveReconcile = (then?: () => void) => {
    reconcile.mutate(
      {
        billableHours: hourly ? (billable.trim() === '' ? null : Number(billable)) : undefined,
        settlements: a.executors.map((e) => ({
          profileId: e.profileId,
          payableHours: Number(payable[e.profileId] ?? e.payableHours),
        })),
      },
      {
        onSuccess: () => {
          setEditing(false)
          toast.success('Звірку збережено')
          then?.()
        },
        onError: () => toast.error('Не вдалося зберегти звірку'),
      }
    )
  }

  const statusChip = accepted
    ? { label: 'прийнято', tone: 'var(--wf-success, var(--wf-accent))' }
    : inReview
      ? { label: 'на прийманні', tone: 'var(--wf-warning)' }
      : { label: 'в роботі', tone: 'var(--wf-fg-muted)' }

  return (
    <Card
      title="Приймання роботи"
      aux={
        <span className="wfp-mono" style={{ fontSize: 11, color: statusChip.tone }}>
          {statusChip.label}
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      {/* 4 числа */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
        <NumCell k="план" v={HRS(a.plannedHours)} />
        <NumCell k="факт" v={HRS(a.trackedHours)} accent />
        {hourly && <NumCell k="білабельно" v={HRS(a.billableHours ?? a.trackedHours)} />}
        <NumCell k="до оплати" v={HRS(payableTotal)} />
      </div>

      {/* Розбивка по виконавцях */}
      {rosterView.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            {editing ? '// усі причетні — розподіли оплату' : '// факт → до оплати'}
          </div>
          {rosterView.map((e) => (
            <div
              key={e.profileId}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.name}
              </span>
              {editing ? (
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={payable[e.profileId] ?? ''}
                  onChange={(ev) => setPayable((p) => ({ ...p, [e.profileId]: ev.target.value }))}
                  style={{ width: 70, textAlign: 'right' }}
                  aria-label={`Оплатні години ${e.name}`}
                />
              ) : (
                <span
                  className="wfp-mono"
                  style={{ flexShrink: 0, color: 'var(--wf-fg-secondary)' }}
                >
                  {HRS(e.trackedHours)} → {HRS(e.payableHours)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Редагування білабельних (погодинне) */}
      {editing && hourly && (
        <div style={{ marginTop: 10 }}>
          <div
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 4 }}
          >
            білабельні години клієнту (пусто = факт)
          </div>
          <Input
            type="number"
            value={billable}
            onChange={(e) => setBillable(e.target.value)}
            placeholder={String(a.trackedHours)}
          />
        </div>
      )}

      {/* Хто здав / прийняв */}
      {(a.submittedBy || a.acceptedBy) && (
        <div
          className="wfp-mono"
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--wf-fg-muted)',
            display: 'grid',
            gap: 2,
          }}
        >
          {a.submittedBy && <div>здав: {a.submittedBy.name}</div>}
          {a.acceptedBy && <div>прийняв: {a.acceptedBy.name}</div>}
        </div>
      )}

      {/* Дії */}
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {status === OrderInternalStatus.IN_PROGRESS && a.allTasksDone && (
          <span
            className="wfp-mono"
            style={{ fontSize: 11, color: 'var(--wf-success, var(--wf-accent))', width: '100%' }}
          >
            // всі задачі виконані — можна здавати на приймання
          </span>
        )}
        {status === OrderInternalStatus.IN_PROGRESS && (isExecutor || isAcceptor) && (
          <Button
            size="sm"
            variant="primary"
            loading={transition.isPending}
            onClick={() =>
              transition.mutate(
                { status: OrderInternalStatus.REVIEW },
                { onSuccess: () => toast.success('Здано на приймання') }
              )
            }
          >
            Здати на приймання
          </Button>
        )}
        {inReview && isExecutor && (
          <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            очікує приймання від керівника
          </span>
        )}
        {inReview && isAcceptor && !editing && sendBack == null && (
          <>
            <Button size="sm" variant="ghost" onClick={startEdit}>
              Скоригувати години
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSendBack('')}>
              Повернути
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { status: OrderInternalStatus.DONE },
                  { onSuccess: () => toast.success('Роботу прийнято') }
                )
              }
            >
              Прийняти
            </Button>
          </>
        )}
        {inReview && isAcceptor && editing && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Скасувати
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={reconcile.isPending}
              onClick={() => saveReconcile()}
            >
              Зберегти звірку
            </Button>
          </>
        )}
      </div>

      {/* Повернення на доопрацювання з коментарем */}
      {inReview && isAcceptor && sendBack != null && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <textarea
            value={sendBack}
            onChange={(e) => setSendBack(e.target.value)}
            placeholder="Що доопрацювати?"
            rows={2}
            style={{ width: '100%', fontSize: 13, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" onClick={() => setSendBack(null)}>
              Скасувати
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { status: OrderInternalStatus.REVISION, comment: sendBack || undefined },
                  {
                    onSuccess: () => {
                      setSendBack(null)
                      toast.success('Повернено на доопрацювання')
                    },
                  }
                )
              }
            >
              Повернути на доопрацювання
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function NumCell({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
      <div
        style={{ fontSize: 15, fontWeight: 600, color: accent ? 'var(--wf-accent)' : undefined }}
      >
        {v}
      </div>
    </div>
  )
}

/**
 * Мультивиконавці: головний виконавець (assignee) + співвиконавці. Головний керується
 * окремо (SLA/комісія тримаються на ньому); тут редагується лише список співвиконавців —
 * PUT замінює повний набір. Джерело кандидатів — команда агенції (useTeam).
 */
function OrderExecutorsCard({
  orderId,
  primary,
  coAssignees,
}: {
  orderId: string
  primary: { id: string; name: string } | null
  coAssignees: { id: string; name: string }[]
}) {
  const { data: team } = useTeam()
  const setCo = useSetOrderCoAssignees(orderId)
  const [editing, setEditing] = useState(false)
  const coIds = new Set(coAssignees.map((c) => c.id))
  // головного не пропонуємо як співвиконавця — він уже виконавець за замовчуванням
  const candidates = (team?.members ?? []).filter((m) => m.profileId !== primary?.id)
  return (
    <Card
      title="Виконавці"
      aux={
        <button
          type="button"
          className="wfp-link"
          style={{ fontSize: 11 }}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'готово' : 'змінити'}
        </button>
      }
      style={{ marginBottom: 16 }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="wfp-side-row">
          <div className="wfp-side-k">головний</div>
          <div className="wfp-side-v">{primary?.name ?? '—'}</div>
        </div>
        {editing ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              // співвиконавці
            </div>
            {candidates.length === 0 ? (
              <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                // немає інших членів команди
              </div>
            ) : (
              candidates.map((m) => (
                <label
                  key={m.profileId}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={coIds.has(m.profileId)}
                    disabled={setCo.isPending}
                    onChange={(e) => {
                      const next = new Set(coIds)
                      if (e.target.checked) next.add(m.profileId)
                      else next.delete(m.profileId)
                      setCo.mutate([...next], {
                        onError: () => toast.error('Не вдалося зберегти виконавців'),
                      })
                    }}
                  />
                  {m.name}
                </label>
              ))
            )}
          </div>
        ) : coAssignees.length === 0 ? (
          <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // без співвиконавців
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {coAssignees.map((c) => (
              <span
                key={c.id}
                className="wfp-mono"
                style={{
                  fontSize: 11,
                  border: '1px solid var(--wf-border)',
                  borderRadius: 999,
                  padding: '2px 10px',
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function OrderTagsCard({ orderId, current }: { orderId: string; current: OrderTag[] }) {
  const { data } = useOrderTags()
  const setTags = useSetOrderTags(orderId)
  const catalog = data?.tags ?? []
  const [editing, setEditing] = useState(false)
  const currentIds = new Set(current.map((t) => t.id))
  if (catalog.length === 0 && current.length === 0) return null
  return (
    <Card
      title="Теги"
      aux={
        <button
          type="button"
          className="wfp-link"
          style={{ fontSize: 11 }}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'готово' : 'змінити'}
        </button>
      }
      style={{ marginBottom: 16 }}
    >
      {editing ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {catalog.map((t) => (
            <label
              key={t.id}
              style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={currentIds.has(t.id)}
                disabled={setTags.isPending}
                onChange={(e) => {
                  const next = new Set(currentIds)
                  if (e.target.checked) next.add(t.id)
                  else next.delete(t.id)
                  setTags.mutate([...next])
                }}
              />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: t.color ?? 'var(--wf-fg-muted)',
                }}
              />
              {t.name}
            </label>
          ))}
        </div>
      ) : current.length === 0 ? (
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // без тегів
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {current.map((t) => (
            <span
              key={t.id}
              className="wfp-mono"
              style={{
                fontSize: 11,
                border: '1px solid var(--wf-border)',
                borderRadius: 999,
                padding: '2px 10px',
                borderColor: t.color ?? 'var(--wf-border)',
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

/** S10-02: SLA-статус замовлення — дедлайни реакції/розв'язання або факт порушення. */
function SlaCard({
  order,
}: {
  order: {
    firstResponseDueAt?: string | null
    resolutionDueAt?: string | null
    firstRespondedAt?: string | null
    slaBreachedAt?: string | null
  }
}) {
  if (!order.firstResponseDueAt && !order.resolutionDueAt) return null
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  const rows: { k: string; v: string; warn: boolean }[] = []
  if (order.firstResponseDueAt) {
    rows.push(
      order.firstRespondedAt
        ? { k: 'перша відповідь', v: `✓ ${fmt(order.firstRespondedAt)}`, warn: false }
        : {
            k: 'відповісти до',
            v: fmt(order.firstResponseDueAt),
            warn: new Date(order.firstResponseDueAt).getTime() < Date.now(),
          }
    )
  }
  if (order.resolutionDueAt) {
    rows.push({
      k: 'розв’язати до',
      v: fmt(order.resolutionDueAt),
      warn: new Date(order.resolutionDueAt).getTime() < Date.now(),
    })
  }
  return (
    <Card title="SLA" style={{ marginBottom: 16 }}>
      {order.slaBreachedAt && (
        <div
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-destructive)', marginBottom: 6 }}
        >
          ⚠ SLA порушено {fmt(order.slaBreachedAt)}
        </div>
      )}
      <div className="wfp-side">
        {rows.map((r) => (
          <div className="wfp-side-row" key={r.k}>
            <div className="wfp-side-k">{r.k}</div>
            <div
              className="wfp-side-v"
              style={r.warn ? { color: 'var(--wf-destructive)' } : undefined}
            >
              {r.v}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** 02-Б: редактор кошторису разового замовлення. Рядок = послуга з каталогу (префіл
 * назви/ціни) або вільний текст; к-сть × ціна. Σ автоматично стає сумою замовлення
 * (billingType=fixed); друкується у СПЕЦИФІКАЦІЇ (рахунок/акт — номенклатура). */
function OrderEstimateEditor({ orderId, editable }: { orderId: string; editable: boolean }) {
  const { data, isLoading } = useOrderEstimate(orderId)
  const save = useSaveOrderEstimate(orderId)
  const { data: servicesData } = useServices()
  const [rows, setRows] = useState<OrderEstimateLine[] | null>(null)

  if (isLoading) return <Skeleton style={{ height: 160 }} />

  const services = servicesData?.services ?? []
  const lines: OrderEstimateLine[] =
    rows ??
    (data?.lines ?? []).map((l) => ({
      serviceId: l.serviceId,
      name: l.name,
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice),
    }))
  const dirty = rows !== null
  const total = lines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0)
  const valid = lines.every((l) => l.name.trim() && l.qty > 0 && l.unitPrice >= 0)

  const set = (i: number, patch: Partial<OrderEstimateLine>) => {
    const next = [...lines]
    next[i] = { ...next[i], ...patch } as OrderEstimateLine
    setRows(next)
  }

  return (
    <Card title="Кошторис" aux={`${formatMoney(total)}`}>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 12 }}
      >
        // довільна розбивка «що і як робили» — друкується у специфікації. Σ позицій стає сумою
        замовлення. Рахунок/акт друкують номенклатуру (селект в «Оцінці»).
      </div>
      {lines.length === 0 && (
        <div
          className="wfp-mono"
          style={{ fontSize: 12, color: 'var(--wf-fg-muted)', marginBottom: 10 }}
        >
          // кошторис порожній — оцінка задається одним числом в «Оцінці» або додайте позиції
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2.4fr 70px 100px auto',
              gap: 8,
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
                ПОСЛУГА
              </span>
              <select
                value={l.serviceId ?? ''}
                disabled={!editable}
                onChange={(e) => {
                  const svc = services.find((x) => x.id === e.target.value)
                  set(i, {
                    serviceId: svc?.id ?? null,
                    ...(svc
                      ? {
                          name: svc.name,
                          unitPrice:
                            svc.defaultPriceUsd != null ? Number(svc.defaultPriceUsd) : l.unitPrice,
                        }
                      : {}),
                  })
                }}
                style={{
                  background: 'var(--wf-surface)',
                  color: 'var(--wf-fg)',
                  border: '1px solid var(--wf-border)',
                  borderRadius: 'var(--wf-radius)',
                  padding: '8px 10px',
                  fontSize: 13,
                }}
              >
                <option value="">— вільний рядок —</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Назва в документі"
              value={l.name}
              disabled={!editable}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <Input
              label="К-сть"
              inputMode="decimal"
              value={String(l.qty)}
              disabled={!editable}
              onChange={(e) => set(i, { qty: Number(e.target.value.replace(',', '.')) || 0 })}
            />
            <Input
              label="Ціна"
              inputMode="decimal"
              value={String(l.unitPrice)}
              disabled={!editable}
              onChange={(e) => set(i, { unitPrice: Number(e.target.value.replace(',', '.')) || 0 })}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={!editable}
              onClick={() => setRows(lines.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <Button
          size="sm"
          variant="secondary"
          disabled={!editable}
          onClick={() => setRows([...lines, { serviceId: null, name: '', qty: 1, unitPrice: 0 }])}
        >
          + Позиція
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!editable || !dirty || !valid}
          loading={save.isPending}
          onClick={() =>
            save.mutate(lines, {
              onSuccess: () => {
                setRows(null)
                toast.success(
                  lines.length > 0
                    ? `Кошторис збережено — сума замовлення ${formatMoney(total)}`
                    : 'Кошторис прибрано'
                )
              },
              onError: () => toast.error('Не вдалося зберегти кошторис'),
            })
          }
        >
          Зберегти кошторис
        </Button>
        {!editable && (
          <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
            // оцінка на погодженні або замовлення закрите — кошторис заблоковано
          </span>
        )}
      </div>
    </Card>
  )
}
