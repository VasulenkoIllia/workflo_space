import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Per-order internal subtask (02/12). Backend: /orders/:orderId/tasks (CRUD). */
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface OrderTask {
  id: string
  title: string
  status: TaskStatus
  assigneeId: string | null
  position: number
  /** Мультивиконавці: головний (assignee) + співвиконавці. */
  assignee?: { id: string; name: string } | null
  coAssignees?: { id: string; name: string }[]
}

const key = (orderId: string) => ['order-tasks', orderId] as const

export function useOrderTasks(orderId: string) {
  return useQuery({
    queryKey: key(orderId),
    queryFn: () => api.get<{ tasks: OrderTask[] }>(`/orders/${orderId}/tasks`),
    enabled: orderId !== '',
  })
}

/** A task on the global board (фінд.#8) — carries its order + assignee for cross-order context.
 * Hours live on the ORDER (TimeLog has no task link), so every card of an order shares the
 * same est-vs-actual bar; loggedHours counts finalized entries only (running timer excluded). */
export interface BoardTask {
  id: string
  title: string
  status: TaskStatus
  assigneeId: string | null
  position: number
  order: { id: string; title: string; estimatedHours: number | null; loggedHours: number }
  assignee: { id: string; name: string } | null
  /** Мультивиконавці: співвиконавці ДОДАТКОВО до головного assignee. */
  coAssignees?: { id: string; name: string }[]
  /** TEAM-BOARDS: команда задачі (таби дошки; null = лише в «Усі»). */
  teamId?: string | null
  team?: { id: string; name: string; color: string | null } | null
  /** TASK-COLUMNS: кастомна колонка (null = fallback свого kind). */
  columnId?: string | null
}

/** GET /workspace/tasks — all agency tasks across orders. Internal team. */
export function useAllTasks(filters: { assigneeId?: string; status?: TaskStatus } = {}) {
  const qs = new URLSearchParams()
  if (filters.assigneeId) qs.set('assigneeId', filters.assigneeId)
  if (filters.status) qs.set('status', filters.status)
  const suffix = qs.toString()
  return useQuery({
    queryKey: ['ws-tasks', filters.assigneeId ?? '', filters.status ?? ''],
    queryFn: () => api.get<{ tasks: BoardTask[] }>(`/workspace/tasks${suffix ? `?${suffix}` : ''}`),
  })
}

/** Move a board task to another column. Reuses the per-order PATCH (the board knows each
 * task's orderId), then refreshes the board. */
export function useMoveBoardTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, id, status }: { orderId: string; id: string; status: TaskStatus }) =>
      api.patch<{ task: OrderTask }>(`/orders/${orderId}/tasks/${id}`, { status }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['ws-tasks'] })
      void qc.invalidateQueries({ queryKey: key(vars.orderId) })
    },
  })
}

/** TASK-COLUMNS: drag у кастомну колонку — сервер дзеркалить status=kind + team. */
export function useMoveTaskToColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, id, columnId }: { orderId: string; id: string; columnId: string }) =>
      api.patch<{ task: OrderTask }>(`/orders/${orderId}/tasks/${id}`, { columnId }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['ws-tasks'] })
      void qc.invalidateQueries({ queryKey: key(vars.orderId) })
    },
  })
}

/** TEAM-BOARDS: перекинути задачу в команду (reuse per-order PATCH). */
export function useSetTaskTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, id, teamId }: { orderId: string; id: string; teamId: string | null }) =>
      api.patch<{ task: OrderTask }>(`/orders/${orderId}/tasks/${id}`, { teamId }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['ws-tasks'] })
      void qc.invalidateQueries({ queryKey: key(vars.orderId) })
    },
  })
}

export function useCreateTask(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title: string) =>
      api.post<{ task: OrderTask }>(`/orders/${orderId}/tasks`, { title }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(orderId) }),
  })
}

export function useUpdateTask(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      status?: TaskStatus
      assigneeId?: string | null
      title?: string
    }) => api.patch<{ task: OrderTask }>(`/orders/${orderId}/tasks/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(orderId) }),
  })
}

export function useDeleteTask(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: true }>(`/orders/${orderId}/tasks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(orderId) }),
  })
}
