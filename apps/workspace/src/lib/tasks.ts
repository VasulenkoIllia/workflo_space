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
}

const key = (orderId: string) => ['order-tasks', orderId] as const

export function useOrderTasks(orderId: string) {
  return useQuery({
    queryKey: key(orderId),
    queryFn: () => api.get<{ tasks: OrderTask[] }>(`/orders/${orderId}/tasks`),
    enabled: orderId !== '',
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
