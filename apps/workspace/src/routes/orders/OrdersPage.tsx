import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Button,
  EmptyState,
  Icon,
  Input,
  Modal,
  Skeleton,
  StatusDot,
  useDebounce,
} from '@workflo/ui'
import { OrderInternalStatus, OrderPriority, OrderType } from '@workflo/types'
import { Select } from '@/components/Select'
import {
  INTERNAL_STATUS_META,
  PRIORITY_LABEL,
  countByStatus,
  useBulkAssign,
  useCreateOrder,
  useOrders,
  type WorkspaceOrder,
} from '@/lib/orders'
import { useCompanies, useProjects } from '@/lib/projects'
import { useTeam } from '@/lib/payouts'
import { useAuth } from '@/contexts/AuthContext'
import {
  useDeletedOrders,
  useRestoreOrder,
  useOrderTags,
  useOrderTemplates,
  useCreateFromTemplate,
} from '@/lib/orders'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'
import { KanbanBoard } from './KanbanBoard'

type View = 'board' | 'table' | 'timeline'

const STATUS_OPTS = [
  { value: '', label: 'Усі статуси' },
  ...Object.entries(INTERNAL_STATUS_META).map(([value, m]) => ({ value, label: m.label })),
]

function isOverdue(o: WorkspaceOrder): boolean {
  return (
    o.dueDate != null &&
    o.internalStatus !== OrderInternalStatus.DONE &&
    o.internalStatus !== OrderInternalStatus.CANCELLED &&
    new Date(o.dueDate).getTime() < Date.now()
  )
}

export function OrdersPage() {
  const { isOwner } = useAuth()
  const [trashOpen, setTrashOpen] = useState(false)
  const [tagF, setTagF] = useState('')
  const orderTags = useOrderTags()
  const [params, setParams] = useSearchParams()
  const viewParam = params.get('view')
  // Design: /orders is the filterable table registry by default; board (kanban) + timeline are
  // opt-in views (the dedicated «Дошка задач» lands in S6).
  const view: View =
    viewParam === 'board' ? 'board' : viewParam === 'timeline' ? 'timeline' : 'table'
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const debounced = useDebounce(search, 300)
  const [statusF, setStatusF] = useState('')
  const [clientF, setClientF] = useState('')
  const [execF, setExecF] = useState('')

  const { data, isLoading, isError } = useOrders({
    search: debounced || undefined,
    status: statusF || undefined,
    companyId: clientF || undefined,
    assigneeId: execF || undefined,
    tags: tagF || undefined,
    limit: 100,
  })
  const unassigned = useOrders({ assigneeId: 'none', limit: 100 })
  const team = useTeam()
  const companies = useCompanies()

  const orders = useMemo(() => data?.orders ?? [], [data])
  const done = countByStatus(orders, [OrderInternalStatus.DONE])
  const inProgress = countByStatus(orders, [
    OrderInternalStatus.IN_PROGRESS,
    OrderInternalStatus.REVISION,
  ])
  const overdueCount = orders.filter(isOverdue).length
  const reviewCount = countByStatus(orders, [OrderInternalStatus.REVIEW])
  // статус-фільтр — plain string (useState('')); порівнюємо зі string-значенням enum
  const REVIEW_F: string = OrderInternalStatus.REVIEW
  const unassignedCount = unassigned.data?.orders.length ?? 0

  const members = team.data?.members ?? []
  const execOpts = [
    { value: '', label: 'Усі виконавці' },
    { value: 'none', label: 'Не призначені' },
    ...members.map((m) => ({ value: m.profileId, label: m.name })),
  ]
  const clientOpts = [
    { value: '', label: 'Усі клієнти' },
    ...(companies.data?.companies ?? []).map((c) => ({ value: c.id, label: c.name })),
  ]

  const setView = (v: View) => {
    const next = new URLSearchParams(params)
    if (v === 'table') next.delete('view')
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
        <div className="wfp-ph-r" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
            <ViewBtn
              label="Таймлайн"
              active={view === 'timeline'}
              onClick={() => setView('timeline')}
            />
          </div>
          {isOwner && (
            <Button variant="ghost" size="sm" onClick={() => setTrashOpen(true)}>
              Кошик
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreating(true)}
            disabled={(companies.data?.companies.length ?? 0) === 0}
          >
            Нове замовлення
          </Button>
        </div>
      </div>

      <div className="wfp-stats" style={{ marginBottom: 16 }}>
        <Stat k="всього" v={String(data?.pagination.total ?? orders.length)} />
        <Stat k="в роботі" v={String(inProgress)} tone="accent" />
        <Stat
          k="на прийманні"
          v={String(reviewCount)}
          tone={reviewCount ? 'accent' : undefined}
          active={statusF === REVIEW_F}
          onClick={() => setStatusF((s) => (s === REVIEW_F ? '' : REVIEW_F))}
        />
        <Stat k="прострочено" v={String(overdueCount)} tone={overdueCount ? 'warn' : undefined} />
        <Stat
          k="не призначені"
          v={String(unassignedCount)}
          tone={unassignedCount ? 'warn' : undefined}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr',
          gap: 10,
          alignItems: 'end',
          marginBottom: 16,
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ПОШУК
          </span>
          <div className="wfp-search" style={{ margin: 0 }}>
            <Icon name="search" size={14} />
            <input
              placeholder="Назва або опис…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <Select label="Статус" value={statusF} onChange={setStatusF} options={STATUS_OPTS} />
        <Select label="Клієнт" value={clientF} onChange={setClientF} options={clientOpts} />
        <Select label="Виконавець" value={execF} onChange={setExecF} options={execOpts} />
        <Select
          label="Тег"
          value={tagF}
          onChange={setTagF}
          options={[
            { value: '', label: 'усі теги' },
            ...(orderTags.data?.tags ?? []).map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
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
          title="Нічого не знайдено"
          description="Змініть пошук чи фільтри — або замовлень ще немає."
        />
      ) : (
        <>
          {data && data.pagination.total > orders.length && (
            <div
              className="wfp-mono"
              style={{ marginBottom: 12, fontSize: 11, color: 'var(--wf-fg-muted)' }}
            >
              // показано перші {orders.length} з {data.pagination.total} — уточніть фільтри
              (пагінація → S10)
            </div>
          )}
          {view === 'board' ? (
            <KanbanBoard orders={orders} doneCount={done} />
          ) : view === 'timeline' ? (
            <TimelineView orders={orders} companies={companies.data?.companies ?? []} />
          ) : (
            <OrdersTable orders={orders} members={members} />
          )}
        </>
      )}
      {trashOpen && <TrashModal onClose={() => setTrashOpen(false)} />}
      {creating && (
        <CreateOrderModal
          companies={companies.data?.companies ?? []}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

const modalControlStyle = {
  width: '100%',
  background: 'var(--wf-surface)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 'var(--wf-radius)',
  padding: '8px 10px',
  fontSize: 14,
} as const

function CreateOrderModal({
  companies,
  onClose,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const create = useCreateOrder()
  const fromTemplate = useCreateFromTemplate()
  const templates = useOrderTemplates()
  const projects = useProjects()
  const [templateId, setTemplateId] = useState('')
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<OrderPriority>(OrderPriority.MEDIUM)
  const [projectId, setProjectId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)

  const titleInvalid = title.trim().length < 3
  const companyProjects = (projects.data?.projects ?? []).filter((p) => p.companyId === companyId)

  const submit = () => {
    if (titleInvalid || !companyId) return
    // S10-01: обраний шаблон → створення через from-template (несе білінг/тип шаблону)
    if (templateId !== '') {
      fromTemplate.mutate(
        { templateId, companyId, title: title.trim() },
        { onSuccess: (res) => navigate(`/orders/${res.order.id}`) }
      )
      return
    }
    create.mutate(
      {
        companyId,
        title: title.trim(),
        description: description.trim() || undefined,
        type: OrderType.CLIENT_ORDER,
        priority,
        projectId: projectId || null,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
        // Explicit override only when checked — unchecked leaves the P-11 cascade
        // (проєкт → компанія → агенція) to decide, NOT force-off.
        requiresApproval: requireApproval || undefined,
      },
      { onSuccess: (res) => navigate(`/orders/${res.order.id}`) }
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Нове замовлення"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Скасувати
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={titleInvalid || !companyId}
            onClick={submit}
          >
            Створити
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {(templates.data?.templates.length ?? 0) > 0 && (
          <Select
            label="З шаблону"
            value={templateId}
            onChange={(v) => {
              setTemplateId(v)
              const t = templates.data?.templates.find((x) => x.id === v)
              if (t) {
                setTitle(t.defaultTitle)
                setDescription(t.defaultDescription ?? '')
              }
            }}
            options={[
              { value: '', label: '— без шаблону —' },
              ...(templates.data?.templates ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        )}
        <Select
          label="Клієнт"
          value={companyId}
          onChange={(v) => {
            setCompanyId(v)
            setProjectId('')
          }}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input
          label="Назва"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={titleInvalid && title.length > 0 ? 'мін. 3 символи' : undefined}
        />
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
            ОПИС
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Деталі, контекст…"
            style={{ ...modalControlStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select
            label="Пріоритет"
            value={priority}
            onChange={(v) => setPriority(v as OrderPriority)}
            options={(['low', 'medium', 'high', 'urgent'] as OrderPriority[]).map((p) => ({
              value: p,
              label: PRIORITY_LABEL[p],
            }))}
          />
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
              ДЕДЛАЙН (ОПЦ.)
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={modalControlStyle}
            />
          </label>
        </div>
        <Select
          label="Проєкт (опц. — під білінг)"
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: '', label: '— без проєкту' },
            ...companyProjects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            cursor: 'pointer',
            padding: '10px 12px',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
          }}
        >
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--wf-accent)' }}
          />
          <span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Погодження оцінки клієнтом (02-А)</span>
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              вимкнено → за налаштуванням проєкту/клієнта/агенції
            </div>
          </span>
        </label>
        {create.isError && (
          <div style={{ color: 'var(--wf-destructive)', fontSize: 12 }}>
            Не вдалося створити — перевірте поля (дедлайн має бути в майбутньому).
          </div>
        )}
      </div>
    </Modal>
  )
}

const DAY_MS = 86_400_000

/** Deadline-oriented view: orders bucketed by due date (overdue/this week/later/none). */
/** S10-03 gantt-view (дизайн wfb-ktime, спрощено інлайн): бар = createdAt → dueDate
 * у 28-денному вікні навколо сьогодні; колір за станом (done/overdue/soon/wip). */
function TimelineView({
  orders,
  companies,
}: {
  orders: WorkspaceOrder[]
  companies: { id: string; name: string }[]
}) {
  const navigate = useNavigate()
  const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const DAYS = 28
  const todayStart = new Date(new Date().toISOString().slice(0, 10)).getTime()
  const windowStart = todayStart - 7 * DAY_MS // тиждень назад + 3 тижні вперед
  const dayIndex = (t: number) =>
    Math.max(0, Math.min(DAYS - 1, Math.floor((t - windowStart) / DAY_MS)))
  const todayIdx = dayIndex(todayStart)

  const isClosed = (o: WorkspaceOrder) =>
    o.internalStatus === OrderInternalStatus.DONE ||
    o.internalStatus === OrderInternalStatus.CANCELLED
  const barState = (o: WorkspaceOrder): 'done' | 'overdue' | 'soon' | 'wip' => {
    if (isClosed(o)) return 'done'
    if (o.dueDate) {
      const due = new Date(o.dueDate).getTime()
      if (due < todayStart) return 'overdue'
      if (due <= todayStart + 3 * DAY_MS) return 'soon'
    }
    return 'wip'
  }
  const STATE_BG: Record<string, string> = {
    done: 'color-mix(in srgb, var(--wf-success) 55%, transparent)',
    overdue: 'color-mix(in srgb, var(--wf-destructive) 70%, transparent)',
    soon: 'color-mix(in srgb, var(--wf-warning) 70%, transparent)',
    wip: 'color-mix(in srgb, var(--wf-accent) 60%, transparent)',
  }

  const bars = orders
    .map((o) => {
      const start = dayIndex(new Date(o.createdAt).getTime())
      const end = o.dueDate
        ? dayIndex(new Date(o.dueDate).getTime())
        : Math.min(DAYS - 1, todayIdx + 4)
      return { o, s: Math.min(start, end), e: Math.max(start, end), state: barState(o) }
    })
    .sort((a, b) => a.s - b.s || a.e - b.e)
  const days = Array.from({ length: DAYS }, (_, i) => i)
  const dayLabel = (i: number) => new Date(windowStart + i * DAY_MS).getUTCDate()
  const isWeekend = (i: number) => {
    const dow = new Date(windowStart + i * DAY_MS).getUTCDay()
    return dow === 0 || dow === 6
  }
  const grid = { display: 'grid', gridTemplateColumns: `repeat(${DAYS}, 1fr)` } as const

  return (
    <div style={{ border: '1px solid var(--wf-border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* шапка днів */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          borderBottom: '1px solid var(--wf-border)',
        }}
      >
        <div
          className="wfp-mono"
          style={{ fontSize: 10, color: 'var(--wf-fg-muted)', padding: '6px 10px' }}
        >
          замовлення · клієнт
        </div>
        <div style={grid}>
          {days.map((d) => (
            <div
              key={d}
              className="wfp-mono"
              style={{
                fontSize: 9,
                textAlign: 'center',
                padding: '6px 0',
                color: d === todayIdx ? 'var(--wf-accent)' : 'var(--wf-fg-muted)',
                background: isWeekend(d)
                  ? 'color-mix(in srgb, var(--wf-border) 35%, transparent)'
                  : undefined,
                fontWeight: d === todayIdx ? 700 : 400,
              }}
            >
              {dayLabel(d)}
            </div>
          ))}
        </div>
      </div>
      {/* рядки-бари */}
      {bars.length === 0 ? (
        <div
          className="wfp-mono"
          style={{ fontSize: 12, color: 'var(--wf-fg-muted)', padding: 16 }}
        >
          // немає замовлень у вибірці
        </div>
      ) : (
        bars.map(({ o, s, e, state }) => (
          <div
            key={o.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              borderBottom: '1px solid var(--wf-border)',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => navigate(`/orders/${o.id}`)}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'baseline',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.title}
              </span>
              <span
                className="wfp-mono"
                style={{ fontSize: 10, color: 'var(--wf-fg-muted)', flexShrink: 0 }}
              >
                {nameOf(o.companyId)}
              </span>
            </button>
            <div style={{ ...grid, position: 'relative', height: 30 }}>
              {days.map((d) => (
                <div
                  key={d}
                  style={{
                    borderLeft: d === todayIdx ? '1px solid var(--wf-accent)' : undefined,
                    background: isWeekend(d)
                      ? 'color-mix(in srgb, var(--wf-border) 25%, transparent)'
                      : undefined,
                  }}
                />
              ))}
              <div
                title={`${o.title}${o.dueDate ? ` · до ${formatDate(o.dueDate)}` : ' · без дедлайну'}`}
                style={{
                  position: 'absolute',
                  top: 6,
                  bottom: 6,
                  left: `${(s / DAYS) * 100}%`,
                  width: `${(Math.max(1, e - s + 1) / DAYS) * 100}%`,
                  background: STATE_BG[state],
                  borderRadius: 4,
                  border: o.dueDate ? undefined : '1px dashed var(--wf-fg-muted)',
                }}
              />
            </div>
          </div>
        ))
      )}
      {/* легенда */}
      <div
        className="wfp-mono"
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 10,
          color: 'var(--wf-fg-muted)',
          padding: '8px 10px',
        }}
      >
        {(
          [
            ['wip', 'в роботі'],
            ['soon', 'скоро дедлайн'],
            ['overdue', 'прострочено'],
            ['done', 'закрито'],
          ] as const
        ).map(([k, label]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 14, height: 7, borderRadius: 2, background: STATE_BG[k] }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--wf-accent)' }}>│ сьогодні</span>
      </div>
    </div>
  )
}

function Stat({
  k,
  v,
  tone,
  onClick,
  active,
}: {
  k: string
  v: string
  tone?: 'accent' | 'warn'
  onClick?: () => void
  active?: boolean
}) {
  const color =
    tone === 'warn' ? 'var(--wf-warning)' : tone === 'accent' ? 'var(--wf-accent)' : 'var(--wf-fg)'
  return (
    <div
      className="wfp-stat"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={
        onClick
          ? {
              cursor: 'pointer',
              outline: active ? '1px solid var(--wf-accent)' : undefined,
              outlineOffset: active ? -1 : undefined,
            }
          : undefined
      }
    >
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{v}</div>
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)' }}>
        {k}
      </div>
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
        // Active = subtle lime pill (matches the app's accent-active pattern); a full
        // fg/bg inversion read as a bright white box in dark theme.
        border: active
          ? '1px solid color-mix(in oklab, var(--wf-accent) 40%, transparent)'
          : '1px solid transparent',
        borderRadius: 6,
        padding: '6px 12px',
        background: active
          ? 'color-mix(in oklab, var(--wf-accent) 14%, transparent)'
          : 'transparent',
        color: active ? 'var(--wf-accent)' : 'var(--wf-fg-secondary)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function OrdersTable({
  orders,
  members,
}: {
  orders: WorkspaceOrder[]
  members: { profileId: string; name: string }[]
}) {
  const navigate = useNavigate()
  const bulk = useBulkAssign()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTo, setAssignTo] = useState('')

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOnPage = orders.length > 0 && orders.every((o) => selected.has(o.id))
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(orders.map((o) => o.id)))

  const applyBulk = () => {
    if (selected.size === 0) return
    const assigneeId = assignTo === 'none' ? null : assignTo
    if (assignTo === '') return
    bulk.mutate(
      { ids: [...selected], assigneeId },
      {
        onSuccess: () => {
          setSelected(new Set())
          setAssignTo('')
        },
      }
    )
  }

  return (
    <div>
      {selected.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            marginBottom: 10,
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
            background: 'var(--wf-surface)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} вибрано</span>
          <span style={{ color: 'var(--wf-fg-muted)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>Призначити:</span>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            style={{
              background: 'var(--wf-bg)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              padding: '6px 8px',
              fontSize: 13,
            }}
          >
            <option value="">— виконавець —</option>
            <option value="none">Зняти призначення</option>
            {members.map((m) => (
              <option key={m.profileId} value={m.profileId}>
                {m.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="primary"
            loading={bulk.isPending}
            disabled={assignTo === ''}
            onClick={applyBulk}
          >
            Застосувати
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Зняти вибір
          </Button>
        </div>
      )}

      <table className="wfp-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={allOnPage}
                onChange={toggleAll}
                aria-label="Вибрати все"
              />
            </th>
            <th>№</th>
            <th>Назва</th>
            <th>Статус</th>
            <th>Пріоритет</th>
            <th>Виконавці</th>
            <th>Дедлайн</th>
            <th className="wfp-num">Сума</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const meta = o.internalStatus ? INTERNAL_STATUS_META[o.internalStatus] : null
            const dl = deadlineMeta(o.dueDate)
            const overdue = isOverdue(o)
            const open = () => navigate(`/orders/${o.id}`)
            return (
              <tr
                key={o.id}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                  }
                }}
              >
                <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    aria-label={`Вибрати ${o.title}`}
                  />
                </td>
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
                <td>
                  <ExecutorAvatars primary={o.assignee ?? null} co={o.coAssignees ?? []} />
                </td>
                <td
                  className="wfp-mono"
                  style={{ color: dl.tone === 'over' ? 'var(--wf-destructive)' : undefined }}
                >
                  {formatDate(o.dueDate)}
                  {overdue && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--wf-destructive)' }}>
                      ● прострочено
                    </span>
                  )}
                </td>
                <td className="wfp-num">{formatMoney(o.totalAmount)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Ініціали з імені для аватара («Іван Петренко» → «ІП»). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/**
 * Мультивиконавці у списку: головний (акцент) + співвиконавці як стек аватарів-ініціалів.
 * Понад 3 згортаються у «+N». Прочерк, якщо виконавців немає.
 */
function ExecutorAvatars({
  primary,
  co,
}: {
  primary: { id: string; name: string } | null
  co: { id: string; name: string }[]
}) {
  const all = [
    ...(primary ? [{ ...primary, lead: true }] : []),
    ...co.map((c) => ({ ...c, lead: false })),
  ]
  if (all.length === 0) {
    return (
      <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
        —
      </span>
    )
  }
  const shown = all.slice(0, 3)
  const extra = all.length - shown.length
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <span
          key={m.id}
          title={`${m.name}${m.lead ? ' · головний' : ''}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            marginLeft: i === 0 ? 0 : -6,
            border: '1px solid var(--wf-bg)',
            background: m.lead ? 'var(--wf-accent)' : 'var(--wf-surface-2, var(--wf-border))',
            color: m.lead ? 'var(--wf-accent-fg, #fff)' : 'var(--wf-fg-secondary)',
          }}
        >
          {initials(m.name)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="wfp-mono"
          style={{ marginLeft: 4, fontSize: 11, color: 'var(--wf-fg-muted)' }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}

/** S10-07 «Кошик»: видалені замовлення за останні 30 днів, відкат owner-ом. */
function TrashModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useDeletedOrders()
  const restore = useRestoreOrder()
  const rows = data?.orders ?? []
  return (
    <Modal open onClose={onClose} title="Кошик · видалені замовлення">
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // вікно відновлення — 30 днів від видалення; далі — остаточно
        </div>
        {isLoading ? (
          <Skeleton style={{ height: 80 }} />
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Кошик порожній.</div>
        ) : (
          rows.map((o) => (
            <div
              key={o.id}
              style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13 }}
            >
              <span style={{ fontWeight: 500, flex: 1, minWidth: 0 }}>
                {o.title}
                {o.companyName && (
                  <span
                    className="wfp-mono"
                    style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginLeft: 8 }}
                  >
                    {o.companyName}
                  </span>
                )}
              </span>
              <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                ще {o.daysLeft} дн
              </span>
              <button
                type="button"
                className="wfp-link"
                style={{ fontSize: 12 }}
                disabled={restore.isPending}
                onClick={() => restore.mutate(o.id)}
              >
                відновити
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
