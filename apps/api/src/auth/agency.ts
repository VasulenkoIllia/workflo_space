import type { PrismaClient } from '@workflo/db'

/**
 * Multi-tenancy (ADR-004), Phase 0 — single platform tenant.
 *
 * The S1.6 migration + seed create exactly one Agency (slug 'workflo'). New
 * client companies registered through /auth/register attach to it. Phase 1
 * (SaaS) replaces this resolver with subdomain / signup-context resolution —
 * callers stay unchanged.
 */
export const PLATFORM_AGENCY_SLUG = 'workflo'

/** Resolve the tenant a newly-registered company belongs to. */
export async function resolvePlatformAgencyId(tx: Pick<PrismaClient, 'agency'>): Promise<string> {
  const agency = await tx.agency.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!agency) {
    throw new Error(
      'No agency found — run the S1.6 tenancy migration + seed before registering companies'
    )
  }
  return agency.id
}
