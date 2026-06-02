import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Request-scoped tenant context for the RLS seam (F4 / ADR-007). `tenantTransaction`
 * reads this to set the Postgres GUC (`app.current_agency_id` / `app.rls_bypass`)
 * on the transaction connection so the migration's row-level policies scope it.
 *
 *  - web request  → runWithAgency(activeAgencyId, …)  → tenant-scoped
 *  - worker/seed  → runWithSystemContext(…)           → bypass (sees all tenants)
 *  - no context   → passthrough (RLS policies are permissive when the GUC is unset)
 */
export interface TenantContext {
  agencyId?: string
  bypass?: boolean
}

export const tenantStore = new AsyncLocalStorage<TenantContext>()

/** Bind a tenant for the duration of `fn` (its async subtree). */
export function runWithAgency<T>(agencyId: string, fn: () => T): T {
  return tenantStore.run({ agencyId }, fn)
}

/** System context — RLS bypass for trusted, request-less paths (worker/seed/bootstrap). */
export function runWithSystemContext<T>(fn: () => T): T {
  return tenantStore.run({ bypass: true }, fn)
}

/** Bind a tenant for the current async execution without a callback (Fastify hooks). */
export function enterAgencyContext(agencyId: string): void {
  tenantStore.enterWith({ agencyId })
}

export function getTenantContext(): TenantContext | undefined {
  return tenantStore.getStore()
}
