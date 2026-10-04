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

import { type ModuleKey, getModule } from '@workflo/types'

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

/**
 * Module gate (MOD-1/MOD-2, ADR-008). Typed wrapper over `featureEnabled` keyed
 * by the canonical `ModuleKey` registry — every NEW module (S5.6+) gates its
 * routes + navigation through this from day one, so SaaS packaging later is a
 * data flip (plan → modules), not a handler sweep.
 *
 * Phase 0: permissive (true), but `getModule` throws on an unknown key — a
 * typo'd gate fails loudly in dev/test instead of silently allowing.
 * Phase 1: resolve the agency's plan → enabled module set (resolveModules) and
 * check membership; `AgencyFeatureFlag` overrides per-tenant.
 */
export async function moduleEnabled(agencyId: string, moduleKey: ModuleKey): Promise<boolean> {
  getModule(moduleKey) // validate the key exists in the registry (drift guard)
  return featureEnabled(agencyId, moduleKey)
}

/**
 * Write-gate seam (SAAS.md E2/E6): block mutations for a suspended/past-due tenant.
 * Placed at write sites NOW (no-op) so SaaS subscription suspension becomes a
 * one-function flip later instead of threading a check through every handler.
 * Phase 1: throw `AppError(402/403, 'agency_suspended')` when
 * `Agency.subscriptionStatus ∈ {past_due, suspended, canceled}` (read-only mode).
 */
export async function assertAgencyActive(_agencyId: string): Promise<void> {
  // Phase 0: allow. Phase 1: look up Agency.subscriptionStatus/suspendedAt.
  return Promise.resolve()
}
