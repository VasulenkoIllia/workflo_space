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
  useMoveTaskToColumn,
  useSetTaskTeam,
} from '@/lib/tasks'
import {
  type ColumnKind,
  type Team,
  useCreateColumn,
  useCreateTeam,
  useUpdateTeam,
  useDeleteColumn,
  useDeleteTeam,
  useTeams,
} from '@/lib/teams'
import { useTeam } from '@/lib/payouts'

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
  const { user, isOwner, isManager } = useAuth()
  const myId = user?.profile.id
  const [mine, setMine] = useState(false)
  const { data, isLoading } = useAllTasks(mine && myId ? { assigneeId: myId } : {})
  const move = useMoveBoardTask()
  const setTaskTeam = useSetTaskTeam()
  const moveToColumn = useMoveTaskToColumn()
  const [overCol, setOverCol] = useState<string | null>(null)
  // TEAM-BOARDS: таби команд ('all' = агрегатна «Усі», як у дизайні workspace-board.jsx)
  const { data: teams = [] } = useTeams()
  const [teamTab, setTeamTab] = useState<string>('all')
  const [teamsEditor, setTeamsEditor] = useState(false)
  const [columnsEditor, setColumnsEditor] = useState(false)
  const all = data?.tasks ?? []
  const activeTeam = teamTab === 'all' ? null : (teams.find((tm) => tm.id === teamTab) ?? null)
  // TEAM-ADMIN-1: колонки своєї дошки налаштовує і ТІМЛІД активної команди
  const canConfig = isOwner || isManager || (!!activeTeam && activeTeam.leadId === user?.profile.id)
  const tasks = teamTab === 'all' ? all : all.filter((t) => (t.teamId ?? null) === teamTab)
  const countFor = (teamId: string) => all.filter((t) => t.teamId === teamId).length

  // TASK-COLUMNS view-model: «Усі» = 3 канонічні статуси-якорі; таб команди = її кастомні
  // колонки (drag дзеркалить status=kind на сервері). Задача без колонки (або з видаленою)
  // падає у ПЕРШУ колонку свого kind (fallback — нічого не губиться).
  interface ViewCol {
    key: string
    label: string
    tasks: BoardTask[]
    onDropTask: (t: BoardTask) => void
  }
  let viewCols: ViewCol[]
  if (!activeTeam) {
    viewCols = COLUMNS.map((col) => ({
      key: col.id,
      label: col.label,
      tasks: tasks.filter((t) => t.status === col.id),
      onDropTask: (t) => {
        if (t.status !== col.id) move.mutate({ orderId: t.order.id, id: t.id, status: col.id })
      },
    }))
  } else {
    const cols = activeTeam.columns
    const colIds = new Set(cols.map((c) => c.id))
    const firstOfKind = new Map<string, string>()
    for (const c of cols) if (!firstOfKind.has(c.kind)) firstOfKind.set(c.kind, c.id)
    viewCols = cols.map((col) => ({
      key: col.id,
      label: col.name,
      tasks: tasks.filter((t) => {
        const cid = t.columnId && colIds.has(t.columnId) ? t.columnId : null
        return cid ? cid === col.id : firstOfKind.get(t.status) === col.id
      }),
      onDropTask: (t) => {
        if (t.columnId !== col.id)
          moveToColumn.mutate({ orderId: t.order.id, id: t.id, columnId: col.id })
      },
    }))
  }

  const drop = (colKey: string, t: BoardTask) => {
    setOverCol(null)
    viewCols.find((c) => c.key === colKey)?.onDropTask(t)
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
        {canConfig && activeTeam && (
          <button
            type="button"
            className="wfp-mono"
            onClick={() => setColumnsEditor(true)}
            style={{ ...tabStyle(false), opacity: 0.7 }}
            title="Кастомні колонки цієї дошки (мапляться на канонічні статуси)"
          >
            ⚙ налаштувати дошку
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
            gridTemplateColumns: `repeat(${viewCols.length}, minmax(240px, 1fr))`,
            gap: 12,
            alignItems: 'start',
            overflowX: 'auto',
          }}
        >
          {viewCols.map((col) => (
            <div
              key={col.key}
              onDragOver={(e: DragEvent) => {
                e.preventDefault()
                setOverCol(col.key)
              }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e: DragEvent) => {
                const id = e.dataTransfer.getData('text/plain')
                const t = tasks.find((x) => x.id === id)
                if (t) drop(col.key, t)
              }}
              style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                padding: 10,
                minHeight: 120,
                ...(overCol === col.key ? { outline: '2px dashed var(--wf-accent)' } : {}),
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
                <span>{col.tasks.length}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {col.tasks.map((t) => (
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
      {columnsEditor && activeTeam && (
        <ColumnsEditorModal team={activeTeam} onClose={() => setColumnsEditor(false)} />
      )}
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

/** TEAM-ADMIN-1: селект тімліда підрозділу (owner; опції — лише члени команди). */
function TeamLeadSelect({ team }: { team: Team }) {
  const { data: rosterData } = useTeam()
  const update = useUpdateTeam()
  const options = (rosterData?.members ?? []).filter((m) => m.teamId === team.id)
  return (
    <select
      value={team.leadId ?? ''}
      disabled={update.isPending}
      title="Тімлід підрозділу"
      onChange={(e) =>
        update.mutate(
          { id: team.id, leadId: e.target.value || null },
          {
            onSuccess: () => toast.success(e.target.value ? 'Тімліда призначено' : 'Тімліда знято'),
            onError: () => toast.error('Не вдалося (лід має бути членом команди)'),
          }
        )
      }
      style={{
        background: 'var(--wf-surface)',
        color: 'var(--wf-fg)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius)',
        padding: '4px 6px',
        fontSize: 12,
        maxWidth: 150,
      }}
    >
      <option value="">без тімліда</option>
      {options.map((m) => (
        <option key={m.profileId} value={m.profileId}>
          ★ {m.name}
        </option>
      ))}
    </select>
  )
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
            {/* TEAM-ADMIN-1: тімлід — головний у підрозділі; лише з членів команди */}
            <TeamLeadSelect team={tm} />
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

const KIND_LABEL: Record<ColumnKind, string> = {
  todo: 'До роботи',
  in_progress: 'В роботі',
  done: 'Готово',
}

/** TASK-COLUMNS: редактор колонок дошки команди (owner/manager). Кожна колонка мапиться
 * на канонічний статус (kind) — головна дошка і клієнтський рівень консистентні завжди. */
function ColumnsEditorModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const create = useCreateColumn()
  const del = useDeleteColumn()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ColumnKind>('in_progress')

  return (
    <Modal open title={`Дошка «${team.name}» — колонки`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          // кожна колонка мапиться на канонічний статус головної дошки
        </div>
        {team.columns.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ flex: 1 }}>{c.name}</span>
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              → {KIND_LABEL[c.kind]}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!window.confirm(`Видалити колонку «${c.name}»? Задачі не загубляться.`)) return
                del.mutate(
                  { teamId: team.id, columnId: c.id },
                  { onSuccess: () => toast.success('Колонку видалено') }
                )
              }}
            >
              ✕
            </Button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Назва, напр. «Рев'ю»"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ColumnKind)}
            className="wfp-mono"
            style={{ fontSize: 12, padding: 8 }}
            title="На який канонічний статус мапиться"
          >
            {(Object.keys(KIND_LABEL) as ColumnKind[]).map((k) => (
              <option key={k} value={k}>
                → {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={name.trim().length === 0}
            onClick={() =>
              create.mutate(
                { teamId: team.id, name: name.trim(), kind },
                {
                  onSuccess: () => {
                    setName('')
                    toast.success('Колонку додано')
                  },
                }
              )
            }
          >
            + Додати
          </Button>
        </div>
      </div>
    </Modal>
  )
}
