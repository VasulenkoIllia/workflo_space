import { useState } from 'react'
import { Button, EmptyState, Skeleton } from '@workflo/ui'
import { useTeam, type TeamMember } from '@/lib/payouts'
import {
  useCreateTask,
  useDeleteTask,
  useOrderTasks,
  useUpdateTask,
  type OrderTask,
  type TaskStatus,
} from '@/lib/tasks'

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'До роботи' },
  { id: 'in_progress', label: 'В роботі' },
  { id: 'done', label: 'Готово' },
]
const NEXT: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
}
const PREV: Record<TaskStatus, TaskStatus | null> = {
  todo: null,
  in_progress: 'todo',
  done: 'in_progress',
}

const moveBtn = {
  background: 'none',
  border: '1px solid var(--wf-border)',
  borderRadius: 4,
  padding: '2px 7px',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--wf-fg-secondary)',
} as const

function TaskCard({
  task,
  members,
  onMove,
  onAssign,
  onDelete,
}: {
  task: OrderTask
  members: TeamMember[]
  onMove: (s: TaskStatus) => void
  onAssign: (a: string | null) => void
  onDelete: () => void
}) {
  const prev = PREV[task.status]
  const next = NEXT[task.status]
  return (
    <div
      style={{
        border: '1px solid var(--wf-border)',
        borderRadius: 6,
        padding: '8px 10px',
        background: 'var(--wf-surface)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 6,
          textDecoration: task.status === 'done' ? 'line-through' : undefined,
          color: task.status === 'done' ? 'var(--wf-fg-muted)' : undefined,
        }}
      >
        {task.title}
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}
      >
        <select
          value={task.assigneeId ?? ''}
          onChange={(e) => onAssign(e.target.value || null)}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            background: 'var(--wf-surface)',
            color: 'var(--wf-fg-secondary)',
            border: '1px solid var(--wf-border)',
            borderRadius: 4,
            padding: '3px 5px',
          }}
        >
          <option value="">— без виконавця</option>
          {members.map((m) => (
            <option key={m.profileId} value={m.profileId}>
              {m.name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {prev && (
            <button title="назад" onClick={() => onMove(prev)} style={moveBtn}>
              ←
            </button>
          )}
          {next && (
            <button title="далі" onClick={() => onMove(next)} style={moveBtn}>
              →
            </button>
          )}
          <button
            title="видалити"
            onClick={onDelete}
            style={{ ...moveBtn, color: 'var(--wf-destructive)' }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

/** Per-order subtask kanban (todo / in_progress / done). Backend: /orders/:orderId/tasks. */
export function TasksTab({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useOrderTasks(orderId)
  const team = useTeam()
  const create = useCreateTask(orderId)
  const update = useUpdateTask(orderId)
  const del = useDeleteTask(orderId)
  const [title, setTitle] = useState('')

  if (isLoading) return <Skeleton style={{ height: 240 }} />
  if (isError) {
    return (
      <EmptyState
        glyph="// error"
        title="Не вдалося завантажити задачі"
        description="Спробуйте оновити сторінку."
      />
    )
  }

  const members = team.data?.members ?? []
  const tasks = data?.tasks ?? []
  const add = () => {
    const t = title.trim()
    if (t.length === 0) return
    create.mutate(t, { onSuccess: () => setTitle('') })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder="Нова задача…"
          style={{
            flex: 1,
            background: 'var(--wf-surface)',
            color: 'var(--wf-fg)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
            padding: '8px 10px',
            fontSize: 14,
          }}
        />
        <Button variant="primary" size="sm" loading={create.isPending} onClick={add}>
          Додати
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="Задач ще немає" description="Розбийте замовлення на підзадачі вище." />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id)
            return (
              <div
                key={col.id}
                style={{
                  border: '1px solid var(--wf-border)',
                  borderRadius: 8,
                  padding: 10,
                  background: 'var(--wf-subtle)',
                }}
              >
                <div
                  className="wfp-mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--wf-fg-muted)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {col.label} · {colTasks.length}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      members={members}
                      onMove={(s) => update.mutate({ id: t.id, status: s })}
                      onAssign={(a) => update.mutate({ id: t.id, assigneeId: a })}
                      onDelete={() => del.mutate(t.id)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--wf-fg-subtle)', padding: '4px 2px' }}>
                      —
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
