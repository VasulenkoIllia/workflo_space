import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { OrderInternalStatus, type OrderClientStatus, type OrderPriority } from '@workflo/types'
import type { StatusTone } from '@workflo/ui'
import { api } from '@/lib/api'

/** A row from the internal-team orders list (workspace view). */
export interface WorkspaceOrder {
  id: string
  title: string
  clientStatus: OrderClientStatus
  internalStatus?: OrderInternalStatus
  priority: OrderPriority
  dueDate: string | null
  totalAmount: number | null
  companyId: string
  stageCount: number
  createdAt: string
  updatedAt: string
}

export interface OrdersPage {
  orders: WorkspaceOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface OrderFilters {
  /** CSV of internal statuses. */
  status?: string
  search?: string
  /** UUID, or 'none' for unassigned. */
  assigneeId?: string
  companyId?: string
  priority?: string
  sortBy?: 'createdAt' | 'dueDate' | 'priority'
  sortDir?: 'asc' | 'desc'
  limit?: number
}

export function useOrders(filters: OrderFilters) {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.search) qs.set('search', filters.search)
  if (filters.assigneeId) qs.set('assigneeId', filters.assigneeId)
  if (filters.companyId) qs.set('companyId', filters.companyId)
  if (filters.priority) qs.set('priority', filters.priority)
  qs.set('limit', String(filters.limit ?? 100))
  qs.set('sortBy', filters.sortBy ?? 'createdAt')
  qs.set('sortDir', filters.sortDir ?? 'desc')

  return useQuery({
    queryKey: ['ws-orders', filters],
    queryFn: () => api.get<OrdersPage>(`/orders?${qs.toString()}`),
    // Sentinel guard: DashboardPage passes `assigneeId: myId ?? ''` and we must
    // NOT fire "my tasks" before the profile id resolves (empty string). Callers
    // that omit assigneeId (undefined) or pass 'none'/a UUID are always enabled.
    enabled: filters.assigneeId !== '',
  })
}

/** Bulk-assign (or unassign with `null`) an executor to several orders — fans out PATCH
 * /orders/:id/assign, then refreshes the list. */
export function useBulkAssign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, assigneeId }: { ids: string[]; assigneeId: string | null }) =>
      Promise.all(ids.map((id) => api.patch(`/orders/${id}/assign`, { assigneeId }))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-orders'] }),
  })
}

export const INTERNAL_STATUS_META: Record<
  OrderInternalStatus,
  { label: string; tone: StatusTone }
> = {
  [OrderInternalStatus.NEW]: { label: 'новий', tone: 'neutral' },
  [OrderInternalStatus.CLARIFICATION]: { label: 'уточнення', tone: 'warning' },
  [OrderInternalStatus.ESTIMATING]: { label: 'оцінка', tone: 'warning' },
  [OrderInternalStatus.IN_PROGRESS]: { label: 'в роботі', tone: 'accent' },
  [OrderInternalStatus.REVIEW]: { label: 'рев’ю', tone: 'warning' },
  [OrderInternalStatus.REVISION]: { label: 'правки', tone: 'warning' },
  [OrderInternalStatus.ON_HOLD]: { label: 'пауза', tone: 'muted' },
  [OrderInternalStatus.DONE]: { label: 'готово', tone: 'success' },
  [OrderInternalStatus.CANCELLED]: { label: 'скасовано', tone: 'muted' },
}

export const PRIORITY_LABEL: Record<OrderPriority, string> = {
  low: 'низький',
  medium: 'середній',
  high: 'високий',
  urgent: 'терміновий',
}

/** Glyph for the terminal list view, by priority. */
export const PRIORITY_GLYPH: Record<OrderPriority, string> = {
  low: '○',
  medium: '◆',
  high: '●',
  urgent: '▲',
}

export interface KanbanColumn {
  id: string
  title: string
  hint: string
}

/** Active-work columns (display order). DONE/CANCELLED → a separate done-count tile. */
export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'queue', title: 'Нові', hint: 'потребують уваги' },
  { id: 'estimating', title: 'Оцінка', hint: 'оцінюємо обсяг' },
  { id: 'in_progress', title: 'В роботі', hint: 'виконуються' },
  { id: 'review', title: 'Рев’ю', hint: 'на перевірці' },
  { id: 'on_hold', title: 'Пауза', hint: 'призупинені' },
]

/**
 * Active status → board column. Exhaustively typed over every internal status
 * EXCEPT the terminal ones — adding a new `OrderInternalStatus` value (other than
 * DONE/CANCELLED) without mapping it here fails the build, so cards never silently
 * vanish from the board.
 */
const STATUS_COLUMN: Record<
  Exclude<OrderInternalStatus, OrderInternalStatus.DONE | OrderInternalStatus.CANCELLED>,
  string
> = {
  [OrderInternalStatus.NEW]: 'queue',
  [OrderInternalStatus.CLARIFICATION]: 'queue',
  [OrderInternalStatus.ESTIMATING]: 'estimating',
  [OrderInternalStatus.IN_PROGRESS]: 'in_progress',
  [OrderInternalStatus.REVISION]: 'in_progress',
  [OrderInternalStatus.REVIEW]: 'review',
  [OrderInternalStatus.ON_HOLD]: 'on_hold',
}

export function columnForStatus(status: OrderInternalStatus | undefined): string | null {
  if (!status) return null
  return (STATUS_COLUMN as Record<OrderInternalStatus, string | undefined>)[status] ?? null
}

export function groupByColumn(orders: WorkspaceOrder[]): Record<string, WorkspaceOrder[]> {
  const out: Record<string, WorkspaceOrder[]> = {}
  for (const c of KANBAN_COLUMNS) out[c.id] = []
  for (const o of orders) {
    const col = columnForStatus(o.internalStatus)
    if (col && out[col]) out[col].push(o)
  }
  return out
}

export function countByStatus(orders: WorkspaceOrder[], statuses: OrderInternalStatus[]): number {
  return orders.filter((o) => o.internalStatus && statuses.includes(o.internalStatus)).length
}
