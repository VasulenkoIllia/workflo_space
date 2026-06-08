import { useMemo } from 'react'
import { OrderInternalStatus } from '@workflo/types'
import { useOrders, type WorkspaceOrder } from './orders'

/**
 * A client (company) summary derived from the orders list. The orders API is the
 * only client signal available pre-S5 — there is no dedicated companies endpoint
 * yet (rich profiles: names, loyalty tier, payments, debt → clients module, S5/28).
 * Company names aren't in the list DTO, so the list keys by companyId; the detail
 * page resolves the name from a single order's detail.
 */
export interface ClientSummary {
  companyId: string
  total: number
  active: number
  totalValue: number
}

const ACTIVE = (o: WorkspaceOrder) =>
  o.internalStatus !== OrderInternalStatus.DONE &&
  o.internalStatus !== OrderInternalStatus.CANCELLED

export function summariseClients(orders: WorkspaceOrder[]): ClientSummary[] {
  const map = new Map<string, ClientSummary>()
  for (const o of orders) {
    const c = map.get(o.companyId) ?? {
      companyId: o.companyId,
      total: 0,
      active: 0,
      totalValue: 0,
    }
    c.total += 1
    if (ACTIVE(o)) c.active += 1
    c.totalValue += o.totalAmount ?? 0
    map.set(o.companyId, c)
  }
  return [...map.values()].sort((a, b) => b.active - a.active || b.total - a.total)
}

export function useClients() {
  const query = useOrders({ limit: 100 })
  const clients = useMemo(() => summariseClients(query.data?.orders ?? []), [query.data])
  return { ...query, clients }
}
