import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, EmptyState, Input, Modal, Skeleton } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import {
  type BoardTask,
  type TaskStatus,
  useAllTasks,
  useMoveBoardTask,
  useSetTaskTeam,
} from '@/lib/tasks'
import { type Team, useCreateTeam, useDeleteTeam, useTeams } from '@/lib/teams'

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'До роботи' },
  { id: 'in_progress', label: 'В роботі' },
  { id: 'done', label: 'Готово' },
]

/** Est-vs-actual mini-bar of the card's ORDER (годин на задачі нема — rollup у замовлення,
 * канон workspace-board-task.jsx). Без оцінки → лише факт годин; без годин узагалі → нічого. */
function OrderHoursBar({ order }: { order: BoardTask['order'] }) {
  const { estimatedHours: est, loggedHours: logged } = order
  if (est == null || est <= 0) {
    if (logged <= 0) return null
    return (
      <div className="wfp-mono" style={{ fontSize: 10, color: 'var(--wf-fg-muted)', marginTop: 6 }}>
        {logged} год · без оцінки
      </div>
    )
  }
  const pct = (logged / est) * 100
  const over = pct > 100
  return (
    <div
      style={{ marginTop: 6 }}
      title={`Замовлення: ${logged} з ${est} год (${Math.round(pct)}%)`}
    >
      <div
        className="wfp-mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--wf-fg-muted)',
          marginBottom: 3,
        }}
      >
        <span>
          {logged}/{est} год
        </span>
        <span style={over ? { color: 'var(--wf-destructive)' } : undefined}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="wfp-est-bar" style={{ height: 3 }}>
        <div
          className={`wfp-est-bar-fill${over ? ' wfp-est-bar-fill--over' : ''}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

/** Global task board (02-Е / workspace-board.jsx, фінд.#8) — every internal task across the
 * agency's orders, grouped by status. Drag a card between columns to move it (reuses the
 * per-order PATCH). Filter to «мої». */
export function TaskBoardPage() {
  const { user, isOwner } = useAuth()
  const myId = user?.profile.id
  const [mine, setMine] = useState(false)
  const { data, isLoading } = useAllTasks(mine && myId ? { assigneeId: myId } : {})
  const move = useMoveBoardTask()
  const setTaskTeam = useSetTaskTeam()
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)
  // TEAM-BOARDS: таби команд ('all' = агрегатна «Усі», як у дизайні workspace-board.jsx)
  const { data: teams = [] } = useTeams()
  const [teamTab, setTeamTab] = useState<string>('all')
  const [teamsEditor, setTeamsEditor] = useState(false)

  const all = data?.tasks ?? []
  const tasks = teamTab === 'all' ? all : all.filter((t) => (t.teamId ?? null) === teamTab)
  const byCol = (status: TaskStatus) => tasks.filter((t) => t.status === status)
  const countFor = (teamId: string) => all.filter((t) => t.teamId === teamId).length

  const drop = (status: TaskStatus, t: BoardTask) => {
    setOverCol(null)
    if (t.status === status) return
    move.mutate({ orderId: t.order.id, id: t.id, status })
  }

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// задачі команди · усі замовлення</div>
          <h1 className="wfp-ph-h1">Дошка задач</h1>
        </div>
        <div className="wfp-ph-r">
          <button
            type="button"
            className="wfp-link wfp-mono"
            style={{ fontSize: 12 }}
            onClick={() => setMine((v) => !v)}
          >
            {mine ? '← усі задачі' : 'лише мої →'}
          </button>
        </div>
      </div>

      {/* TEAM-BOARDS: таби команд */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 14px' }}>
        <button
          type="button"
          className="wfp-mono"
          data-on={teamTab === 'all' || undefined}
          onClick={() => setTeamTab('all')}
          style={tabStyle(teamTab === 'all')}
        >
          Усі <span style={{ opacity: 0.6 }}>{all.length}</span>
        </button>
        {teams.map((tm) => (
          <button
            key={tm.id}
            type="button"
            className="wfp-mono"
            onClick={() => setTeamTab(tm.id)}
            style={tabStyle(teamTab === tm.id)}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 99,
                background: tm.color ?? 'var(--wf-fg-muted)',
                marginRight: 6,
              }}
            />
            {tm.name} <span style={{ opacity: 0.6 }}>{countFor(tm.id)}</span>
          </button>
        ))}
        {isOwner && (
          <button
            type="button"
            className="wfp-mono"
            onClick={() => setTeamsEditor(true)}
            style={{ ...tabStyle(false), opacity: 0.7 }}
            title="Керувати командами"
          >
            ⚙ команди
          </button>
        )}
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : tasks.length === 0 ? (
        <EmptyState
          title={mine ? 'У вас немає задач' : 'Задач ще немає'}
          description="Задачі створюються в деталі замовлення (таб «Задачі»)."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e: DragEvent) => {
                e.preventDefault()
                setOverCol(col.id)
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e: DragEvent) => {
                const id = e.dataTransfer.getData('text/plain')
                const t = tasks.find((x) => x.id === id)
                if (t) drop(col.id, t)
              }}
              style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: 10,
                minHeight: 120,
                ...(overCol === col.id ? { outline: '2px dashed var(--wf-accent)' } : {}),
              }}
            >
              <div
                className="wfp-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--wf-fg-muted)',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{col.label}</span>
                <span>{byCol(col.id).length}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {byCol(col.id).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/plain', t.id)}
                    style={{
                      background: 'var(--wf-bg)',
                      border: '1px solid var(--wf-border)',
                      borderRadius: 'var(--wf-radius)',
                      padding: '8px 10px',
                      cursor: 'grab',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t.title}</div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Link
                        to={`/orders/${t.order.id}`}
                        className="wfp-link wfp-mono"
                        style={{
                          fontSize: 11,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.order.title}
                      </Link>
                      <span
                        className="wfp-mono"
                        title={[t.assignee?.name, ...(t.coAssignees ?? []).map((c) => c.name)]
                          .filter(Boolean)
                          .join(', ')}
                        style={{ fontSize: 11, color: 'var(--wf-fg-subtle)', flexShrink: 0 }}
                      >
                        {t.assignee?.name ?? '—'}
                        {(t.coAssignees?.length ?? 0) > 0 && (
                          <span style={{ color: 'var(--wf-accent)' }}>
                            {' '}
                            +{t.coAssignees?.length}
                          </span>
                        )}
                      </span>
                    </div>
                    <OrderHoursBar order={t.order} />
                    {teams.length > 0 && (
                      <select
                        value={t.teamId ?? ''}
                        onChange={(e) =>
                          setTaskTeam.mutate({
                            orderId: t.order.id,
                            id: t.id,
                            teamId: e.target.value || null,
                          })
                        }
                        className="wfp-mono"
                        style={{
                          marginTop: 6,
                          fontSize: 10,
                          padding: '2px 4px',
                          background: 'transparent',
                          border: '1px solid var(--wf-border)',
                          borderRadius: 4,
                          color: t.team?.color ?? 'var(--wf-fg-muted)',
                          maxWidth: '100%',
                        }}
                        title="Команда задачі"
                      >
                        <option value="">без команди</option>
                        {teams.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {teamsEditor && <TeamsEditorModal teams={teams} onClose={() => setTeamsEditor(false)} />}
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--wf-border)',
    background: active ? 'var(--wf-surface)' : 'transparent',
    color: active ? 'var(--wf-fg)' : 'var(--wf-fg-muted)',
    cursor: 'pointer',
  }
}

/** TEAM-BOARDS: owner-редактор команд — додати/видалити (люди й задачі при
 * видаленні НЕ губляться: FK SetNull → «без команди», видно в «Усі»). */
function TeamsEditorModal({ teams, onClose }: { teams: Team[]; onClose: () => void }) {
  const create = useCreateTeam()
  const del = useDeleteTeam()
  const [name, setName] = useState('')

  return (
    <Modal open title="Команди" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        {teams.length === 0 && (
          <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
            // команд ще немає — додай першу
          </div>
        )}
        {teams.map((tm) => (
          <div key={tm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: tm.color ?? 'var(--wf-fg-muted)',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{tm.name}</span>
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              {tm._count.members} люд · {tm._count.tasks} задач
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!window.confirm(`Видалити команду «${tm.name}»? Люди й задачі лишаться.`))
                  return
                del.mutate(tm.id, { onSuccess: () => toast.success('Команду видалено') })
              }}
            >
              ✕
            </Button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Назва команди, напр. «Dev»"
          />
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={name.trim().length === 0}
            onClick={() =>
              create.mutate(name.trim(), {
                onSuccess: () => {
                  setName('')
                  toast.success('Команду створено')
                },
              })
            }
          >
            + Додати
          </Button>
        </div>
      </div>
    </Modal>
  )
}
