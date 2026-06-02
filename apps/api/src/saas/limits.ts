/**
 * SaaS quota / feature seam (SAAS.md F2, ADR-007).
 *
 * Phase 0: permissive no-ops. The point of placing the call sites NOW (while
 * there are ~2 create-points) is that enabling per-plan limits later is a
 * one-function change, not a sweep of 20 handlers across S2-S8.
 *
 * Phase 1 (SaaS enablement): `assertWithinQuota` checks `UsageCounter` vs
 * `PLAN_LIMITS[agency.plan][resource]`; `featureEnabled` checks the agency's
 * plan + `AgencyFeatureFlag`. Both stay called from the same sites.
 */

export type QuotaResource = 'orders' | 'seats' | 'storage' | 'integrations' | 'leads'

/** Throw `AppError(403, 'quota_exceeded')` when the tenant is over its plan limit. No-op in Phase 0. */
export async function assertWithinQuota(
  _agencyId: string,
  _resource: QuotaResource,
  _delta = 1
): Promise<void> {
  // Phase 0: allow. Phase 1: compare UsageCounter(period) + delta vs plan limit.
  return Promise.resolve()
}

/** Whether a plan/flag-gated feature is on for the tenant. Always true in Phase 0. */
export async function featureEnabled(_agencyId: string, _flag: string): Promise<boolean> {
  // Phase 0: on. Phase 1: per-agency AgencyFeatureFlag + plan tier.
  return Promise.resolve(true)
}
