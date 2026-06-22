import { useMemo } from 'react'
import { OrderInternalStatus } from '@workflo/types'
import { useOrders, type WorkspaceOrder } from './orders'
import { useCompanies } from './projects'

/**
 * Client (company) row: the agency's company registry (GET /workspace/companies —
 * real names + loyalty tier) enriched with order activity derived from the orders
 * list. Rich profile fields still pending backend (LTV / debt / industry / last
 * contact → clients module 28).
 */
export interface ClientRow {
  companyId: string
  name: string
  loyaltyTier: string | null
  total: number
  active: number
  totalValue: number
}

interface OrderSummary {
  companyId: string
  total: number
  active: number
  totalValue: number
}

const ACTIVE = (o: WorkspaceOrder) =>
  o.internalStatus !== OrderInternalStatus.DONE &&
  o.internalStatus !== OrderInternalStatus.CANCELLED

export function summariseClients(orders: WorkspaceOrder[]): OrderSummary[] {
  const map = new Map<string, OrderSummary>()
  for (const o of orders) {
    const c = map.get(o.companyId) ?? { companyId: o.companyId, total: 0, active: 0, totalValue: 0 }
    c.total += 1
    if (ACTIVE(o)) c.active += 1
    c.totalValue += o.totalAmount ?? 0
    map.set(o.companyId, c)
  }
  return [...map.values()]
}

export function useClients() {
  const orders = useOrders({ limit: 100 })
  const companies = useCompanies()
  const clients = useMemo<ClientRow[]>(() => {
    const sById = new Map(summariseClients(orders.data?.orders ?? []).map((s) => [s.companyId, s]))
    const comps = companies.data?.companies ?? []
    // Registry = all agency companies, enriched with order activity. If the companies
    // endpoint is unavailable, fall back to the order-derived list (id-keyed names).
    const base: ClientRow[] = comps.length
      ? comps.map((c) => {
          const s = sById.get(c.id)
          return {
            companyId: c.id,
            name: c.name,
            loyaltyTier: c.loyaltyTier,
            total: s?.total ?? 0,
            active: s?.active ?? 0,
            totalValue: s?.totalValue ?? 0,
          }
        })
      : [...sById.values()].map((s) => ({
          companyId: s.companyId,
          name: `Клієнт · ${s.companyId.slice(0, 8)}`,
          loyaltyTier: null,
          total: s.total,
          active: s.active,
          totalValue: s.totalValue,
        }))
    return base.sort((a, b) => b.active - a.active || b.total - a.total)
  }, [orders.data, companies.data])

  return {
    clients,
    isLoading: orders.isLoading || companies.isLoading,
    isError: orders.isError || companies.isError,
  }
}
