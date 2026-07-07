import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  OrderInternalStatus,
  canTransitionOrder,
  type OrderClientStatus,
  type OrderPriority,
  type OrderType,
} from '@workflo/types'
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
  /** Мультивиконавці (internal-only): головний + співвиконавці. */
  assignee?: { id: string; name: string } | null
  coAssignees?: { id: string; name: string }[]
}

export interface OrdersPage {
  orders: WorkspaceOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface OrderFilters {
  /** S10-01: CSV tag-ids */
  tags?: string
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
  if (filters.tags) qs.set('tags', filters.tags)
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

/** POST /workspace/orders — team creates a (client or internal) order, optionally under a
 * project. `dueDate` must be an ISO datetime in the future. */
export interface CreateWorkspaceOrderInput {
  companyId: string
  title: string
  description?: string
  type?: OrderType
  priority?: OrderPriority
  projectId?: string | null
  dueDate?: string
  /** 02-А explicit override: true → оцінку погоджує клієнт перед стартом. Omitted →
   * P-11 каскад (проєкт → компанія → агенція) вирішує сам. */
  requiresApproval?: boolean
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateWorkspaceOrderInput) =>
      api.post<{ order: { id: string } }>('/workspace/orders', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-orders'] }),
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

/**
 * Dropping a card on a board column moves the order to the FIRST status mapped to that
 * column that is a legal transition from the card's current status — so dragging an
 * «оцінка» card back to «Нові» resolves to CLARIFICATION (allowed), not NEW (not).
 * Returns null when nothing in the column is reachable → an invalid drop the UI rejects.
 */
const COLUMN_DROP_TARGETS: Record<string, OrderInternalStatus[]> = {
  queue: [OrderInternalStatus.CLARIFICATION, OrderInternalStatus.NEW],
  estimating: [OrderInternalStatus.ESTIMATING],
  in_progress: [OrderInternalStatus.IN_PROGRESS, OrderInternalStatus.REVISION],
  review: [OrderInternalStatus.REVIEW],
  on_hold: [OrderInternalStatus.ON_HOLD],
  done: [OrderInternalStatus.DONE],
}

export function resolveDropStatus(
  from: OrderInternalStatus | undefined,
  columnId: string
): OrderInternalStatus | null {
  if (!from) return null
  const candidates = COLUMN_DROP_TARGETS[columnId] ?? []
  return candidates.find((s) => s !== from && canTransitionOrder(from, s)) ?? null
}

/** PATCH /orders/:id/status — move an order through the internal state machine, with an
 * optimistic board update that rolls back if the server rejects the transition. */
export function useTransitionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderInternalStatus }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['ws-orders'] })
      const snapshot = qc.getQueriesData<OrdersPage>({ queryKey: ['ws-orders'] })
      for (const [key, data] of snapshot) {
        if (!data) continue
        qc.setQueryData<OrdersPage>(key, {
          ...data,
          orders: data.orders.map((o) => (o.id === id ? { ...o, internalStatus: status } : o)),
        })
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['ws-orders'] }),
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

// ── S10-07 «Кошик»: видалені замовлення (owner, вікно 30 днів) ──────────────────────
export interface DeletedOrder {
  id: string
  title: string
  companyName: string | null
  deletedAt: string
  daysLeft: number
}

export function useDeletedOrders() {
  return useQuery({
    queryKey: ['ws-orders-deleted'],
    queryFn: () => api.get<{ orders: DeletedOrder[] }>('/workspace/orders/deleted'),
  })
}

export function useRestoreOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => api.post(`/workspace/orders/${orderId}/restore`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws-orders-deleted'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

// ── S10-01: теги замовлень + шаблони ─────────────────────────────────────────────────
export interface OrderTag {
  id: string
  name: string
  color: string | null
}

export function useOrderTags() {
  return useQuery({
    queryKey: ['order-tags'],
    queryFn: () => api.get<{ tags: OrderTag[] }>('/workspace/order-tags'),
  })
}

export function useCreateOrderTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; color?: string | null }) =>
      api.post<{ tag: OrderTag }>('/workspace/order-tags', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['order-tags'] }),
  })
}

export function useDeleteOrderTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/order-tags/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order-tags'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/** Replace-set тегів замовлення (команда). */
export function useSetOrderTags(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagIds: string[]) =>
      api.put<{ tags: OrderTag[] }>(`/orders/${orderId}/tags`, { tagIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
      void qc.invalidateQueries({ queryKey: ['order-tags-of', orderId] })
    },
  })
}

export interface OrderTemplate {
  id: string
  name: string
  type: string
  defaultTitle: string
  defaultDescription: string | null
  defaultBillingType: string
  defaultPrice: string | null
  isActive: boolean
}

export function useOrderTemplates() {
  return useQuery({
    queryKey: ['order-templates'],
    queryFn: () => api.get<{ templates: OrderTemplate[] }>('/workspace/order-templates'),
  })
}

export function useCreateOrderTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      defaultTitle: string
      defaultDescription?: string | null
      defaultBillingType?: string
      defaultPrice?: number | null
    }) => api.post<{ template: OrderTemplate }>('/workspace/order-templates', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['order-templates'] }),
  })
}

export function useDeleteOrderTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/order-templates/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['order-templates'] }),
  })
}

/** Створити замовлення з шаблону (компанія обовʼязкова, назву можна перекрити). */
export function useCreateFromTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      templateId,
      companyId,
      title,
    }: {
      templateId: string
      companyId: string
      title?: string
    }) =>
      api.post<{ order: { id: string; title: string } }>(
        `/workspace/orders/from-template/${templateId}`,
        { companyId, ...(title ? { title } : {}) }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
