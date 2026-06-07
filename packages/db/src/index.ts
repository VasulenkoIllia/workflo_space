import { type Prisma, PrismaClient } from '@prisma/client'
import { tenantStore } from './tenantContext.js'

export const prisma: PrismaClient = new PrismaClient()

/**
 * RLS-correct interactive transaction (F4 / ADR-007). Sets the tenant GUC ONCE on
 * the transaction's connection, so every statement inside is scoped by the
 * migration's row-level policies, then runs `fn` with that `tx`. This is the
 * ONLY mechanism we use for RLS — a per-op `$extends` that auto-injects the GUC was
 * prototyped and REJECTED: Prisma's extension `query(args)` returns a plain Promise
 * (not a deferred PrismaPromise), so the array-form `$transaction([set_config,
 * query])` runs the query EAGERLY outside the GUC tx → zero isolation (verified on
 * throwaway-pg). The interactive-tx form below IS proven to isolate.
 *
 * No tenant bound (RLS_ENFORCED off / pre-auth bootstrap) → behaves exactly like a
 * plain `$transaction`. See docs/ENGINEERING_STANDARDS.md → "RLS rollout".
 */
export async function tenantTransaction<T>(
  client: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return client.$transaction(async (tx) => {
    const ctx = tenantStore.getStore()
    if (!ctx) return fn(tx)
    if (ctx.bypass) {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`
    } else {
      await tx.$executeRaw`SELECT set_config('app.current_agency_id', ${ctx.agencyId ?? ''}, true)`
    }
    return fn(tx)
  })
}

/**
 * Convenience wrapper: run a single tenant-scoped read OR write through
 * `tenantTransaction` on the shared client, so the RLS GUC is set for it
 * (F4 / ADR-007). Use at every handler that touches a tenant table:
 *
 *   const orders = await withTenant((tx) => tx.order.findMany({ where }))
 *
 * No tenant bound (RLS off / pre-auth) → behaves like a plain query. For
 * multi-statement writes that must be atomic, call `tenantTransaction` directly.
 */
export function withTenant<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return tenantTransaction(prisma, fn)
}

// Re-export Prisma runtime + types so consumers don't need a direct
// @prisma/client dependency (keeps the generated client a db-package concern).
export { Prisma, PrismaClient } from '@prisma/client'

export { provisionAgency, type ProvisionAgencyInput } from './provisioning.js'
export {
  type TenantContext,
  tenantStore,
  runWithAgency,
  runWithSystemContext,
  enterAgencyContext,
  getTenantContext,
} from './tenantContext.js'
