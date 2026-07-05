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
function TimelineView({
  orders,
  companies,
}: {
  orders: WorkspaceOrder[]
  companies: { id: string; name: string }[]
}) {
  const navigate = useNavigate()
  const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const now = Date.now()
  const stillOpen = (o: WorkspaceOrder) =>
    o.internalStatus !== OrderInternalStatus.DONE &&
    o.internalStatus !== OrderInternalStatus.CANCELLED

  const overdue: WorkspaceOrder[] = []
  const week: WorkspaceOrder[] = []
  const later: WorkspaceOrder[] = []
  const noDate: WorkspaceOrder[] = []
  for (const o of orders) {
    if (o.dueDate == null) noDate.push(o)
    else {
      const t = new Date(o.dueDate).getTime()
      if (t < now && stillOpen(o)) overdue.push(o)
      else if (t < now + 7 * DAY_MS) week.push(o)
      else later.push(o)
    }
  }
  const byDue = (a: WorkspaceOrder, b: WorkspaceOrder) =>
    (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
    (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
  const buckets: { key: string; label: string; warn?: boolean; rows: WorkspaceOrder[] }[] = [
    { key: 'overdue', label: 'Прострочено', warn: true, rows: overdue.sort(byDue) },
    { key: 'week', label: 'Цей тиждень', rows: week.sort(byDue) },
    { key: 'later', label: 'Пізніше', rows: later.sort(byDue) },
    { key: 'none', label: 'Без дедлайну', rows: noDate.sort(byDue) },
  ]

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {buckets
        .filter((b) => b.rows.length > 0)
        .map((b) => (
          <div key={b.key}>
            <div
              className="wfp-mono"
              style={{
                fontSize: 11,
                color: b.warn ? 'var(--wf-warning)' : 'var(--wf-fg-muted)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              // {b.label} · {b.rows.length}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {b.rows.map((o) => {
                const meta = o.internalStatus ? INTERNAL_STATUS_META[o.internalStatus] : undefined
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => navigate(`/orders/${o.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: '1px solid var(--wf-border)',
                      borderRadius: 8,
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="wfp-mono"
                      style={{
                        flexShrink: 0,
                        width: 86,
                        fontSize: 12,
                        color: b.warn ? 'var(--wf-warning)' : 'var(--wf-fg-secondary)',
                      }}
                    >
                      {o.dueDate ? formatDate(o.dueDate) : '—'}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 500,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {o.title}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--wf-fg-muted)', flexShrink: 0 }}>
                      {nameOf(o.companyId)}
                    </span>
                    {meta && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        <StatusDot tone={meta.tone} />
                        {meta.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'accent' | 'warn' }) {
  const color =
    tone === 'warn' ? 'var(--wf-warning)' : tone === 'accent' ? 'var(--wf-accent)' : 'var(--wf-fg)'
  return (
    <div className="wfp-stat">
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
