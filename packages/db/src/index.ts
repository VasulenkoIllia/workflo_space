import { type Prisma, PrismaClient } from '@prisma/client'
import { tenantStore } from './tenantContext.js'

// RLS activation (ADR-007 activation checklist, step 1): when DATABASE_APP_URL is
// set the shared client connects as the restricted `workflo_app` role, so the F4
// policies actually apply (superuser/owner connections bypass RLS). Processes that
// must keep the owner connection — migrate deploy, seed, the dedicated worker —
// simply don't set DATABASE_APP_URL in their environment.
export const prisma: PrismaClient = new PrismaClient(
  process.env.DATABASE_APP_URL ? { datasourceUrl: process.env.DATABASE_APP_URL } : undefined
)

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
 * No tenant bound + RLS_ENFORCED off (pre-auth bootstrap / rollout-transitional) →
 * behaves exactly like a plain `$transaction`. No tenant bound + RLS_ENFORCED=true →
 * THROWS (AR-23, audit 2026-06-11): the RLS policies are permissive when the GUC is
 * unset, so a lost AsyncLocalStorage context (timer / event-emitter callback) would
 * otherwise degrade to a silent cross-tenant query. System paths (workers, seed,
 * bootstrap) must wrap themselves in `runWithSystemContext` — that binds an explicit
 * bypass context and is unaffected. See docs/ENGINEERING_STANDARDS.md → "RLS rollout".
 */
export async function tenantTransaction<T>(
  client: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return client.$transaction(async (tx) => {
    const ctx = tenantStore.getStore()
    if (!ctx) {
      if (process.env.RLS_ENFORCED === 'true') {
        throw new Error(
          'tenantTransaction: no tenant context bound while RLS_ENFORCED=true — ' +
            'refusing a fail-open query. Request paths must pass through ' +
            'enterAgencyContext; system paths must use runWithSystemContext.'
        )
      }
      return fn(tx)
    }
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
