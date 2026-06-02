import { type Prisma, PrismaClient } from '@prisma/client'
import { tenantStore } from './tenantContext.js'

const base = new PrismaClient()

/**
 * RLS tenant-context extension (F4 / ADR-007). When a request has bound a tenant
 * context (runWithAgency / runWithSystemContext), wrap the operation in a tx that
 * first sets the Postgres GUC, so the migration's row-level policies scope it:
 *   [ set_config('app.current_agency_id' | 'app.rls_bypass'), <the query> ]
 *
 * Activation is gated by `RLS_ENFORCED=true` AND the web layer connecting as the
 * non-superuser `workflo_app` role (superusers/owners bypass RLS). With the flag
 * off — the default — nothing binds a context, so this is never installed and the
 * client is the plain PrismaClient (zero behaviour change). See
 * docs/ENGINEERING_STANDARDS.md → "RLS rollout" for the activation checklist
 * (incl. setting the GUC at the top of interactive transactions).
 */
function withRls(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const ctx = tenantStore.getStore()
        if (!ctx) return (await query(args)) as unknown
        const setter = ctx.bypass
          ? client.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`
          : client.$executeRaw`SELECT set_config('app.current_agency_id', ${ctx.agencyId ?? ''}, true)`
        // Array-form tx pins the SET + query to one connection so the GUC applies.
        // `query` returns a plain Promise in the extension API — cast to PrismaPromise.
        const [, result] = await client.$transaction([
          setter,
          query(args) as Prisma.PrismaPromise<unknown>,
        ])
        return result
      },
    },
  }) as unknown as PrismaClient
}

export const prisma: PrismaClient = process.env.RLS_ENFORCED === 'true' ? withRls(base) : base

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
