import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, EmptyState, Icon, Skeleton, StatusDot, useDebounce } from '@workflo/ui'
import { OrderInternalStatus } from '@workflo/types'
import { Select } from '@/components/Select'
import {
  INTERNAL_STATUS_META,
  PRIORITY_LABEL,
  countByStatus,
  useBulkAssign,
  useOrders,
  type WorkspaceOrder,
} from '@/lib/orders'
import { useCompanies } from '@/lib/projects'
import { useTeam } from '@/lib/payouts'
import { deadlineMeta, formatDate, formatMoney } from '@/lib/format'
import { KanbanBoard } from './KanbanBoard'

type View = 'board' | 'table'

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
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) === 'table' ? 'table' : 'board'
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const [statusF, setStatusF] = useState('')
  const [clientF, setClientF] = useState('')
  const [execF, setExecF] = useState('')

  const { data, isLoading, isError } = useOrders({
    search: debounced || undefined,
    status: statusF || undefined,
    companyId: clientF || undefined,
    assigneeId: execF || undefined,
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
    if (v === 'board') next.delete('view')
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
        <div className="wfp-ph-r">
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
          </div>
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
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
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
          ) : (
            <OrdersTable orders={orders} members={members} />
          )}
        </>
      )}
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
        border: 0,
        padding: '6px 12px',
        background: active ? 'var(--wf-fg)' : 'transparent',
        color: active ? 'var(--wf-bg)' : 'var(--wf-fg-secondary)',
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
