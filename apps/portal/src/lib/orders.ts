import { useQuery } from '@tanstack/react-query'
import {
  INTERNAL_TO_CLIENT_STATUS,
  OrderClientStatus,
  type OrderInternalStatus,
  type OrderPriority,
} from '@workflo/types'
import type { StatusTone } from '@workflo/ui'
import { api } from '@/lib/api'

export interface PortalOrder {
  id: string
  title: string
  clientStatus: OrderClientStatus
  priority: OrderPriority
  dueDate: string | null
  totalAmount: number | null
  stageCount: number
  companyId: string
  createdAt: string
  updatedAt: string
}

export interface OrdersPage {
  orders: PortalOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/** The API filters by internalStatus; expand a client status to its internal set. */
function internalStatusesFor(client: OrderClientStatus): string {
  return (Object.keys(INTERNAL_TO_CLIENT_STATUS) as OrderInternalStatus[])
    .filter((internal) => INTERNAL_TO_CLIENT_STATUS[internal] === client)
    .join(',')
}

export function useOrders(filters: { status?: OrderClientStatus; search?: string }) {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', internalStatusesFor(filters.status))
  if (filters.search) qs.set('search', filters.search)
  qs.set('limit', '50')
  qs.set('sortBy', 'createdAt')
  qs.set('sortDir', 'desc')

  return useQuery({
    queryKey: ['orders', filters.status ?? 'all', filters.search ?? ''],
    queryFn: () => api.get<OrdersPage>(`/orders?${qs.toString()}`),
  })
}

export const CLIENT_STATUS_META: Record<OrderClientStatus, { label: string; tone: StatusTone }> = {
  [OrderClientStatus.IN_PROGRESS]: { label: 'в роботі', tone: 'accent' },
  [OrderClientStatus.PENDING_APPROVAL]: { label: 'очікує дії', tone: 'warning' },
  [OrderClientStatus.COMPLETED]: { label: 'готово', tone: 'success' },
  [OrderClientStatus.CANCELLED]: { label: 'скасовано', tone: 'muted' },
}

export const PRIORITY_LABEL: Record<OrderPriority, string> = {
  low: 'низький',
  medium: 'середній',
  high: 'високий',
  urgent: 'терміновий',
}
