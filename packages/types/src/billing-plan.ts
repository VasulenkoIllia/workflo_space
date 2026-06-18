import { ALWAYS_ON_MODULES, type ModuleKey, isModuleKey, resolveModules } from './modules.js'

/**
 * BillingPlan.modules (MOD-3, ADR-008 §«Що закладаємо ЗАРАЗ»). A plan's `features`
 * Json carries its module selection; enabling a module auto-enables its graph
 * dependencies (`resolveModules`), so an invalid combo like "Chat without Orders"
 * is auto-completed rather than sold broken. Unknown keys are reported as errors.
 *
 * Foundation only (до фронтенд-проходу): these pure helpers are what Phase 1 wires
 * into `featureEnabled()` (plan → enabled set) and plan-admin validation. No UI here.
 *
 * Canonical stored shape: `{ modules: ModuleKey[] }` (the optional surface a plan
 * grants, dependency-complete, excluding always-on core). A bare `string[]` is also
 * accepted on read (legacy/shorthand). Always-on modules are never stored (not
 * sellable) and always resolved in.
 */

const ALWAYS_ON = new Set<ModuleKey>(ALWAYS_ON_MODULES)

export interface PlanModuleResolution {
  /** Optional modules the plan explicitly lists (valid keys, deduped, no always-on). */
  selected: ModuleKey[]
  /** Full enabled surface: always-on ∪ selected ∪ transitive deps (canonical order). */
  resolved: ModuleKey[]
  /** Dependencies auto-added beyond the explicit selection (excludes always-on). */
  autoAdded: ModuleKey[]
  /** Entries in `features` that are not valid module keys — a plan-config error. */
  unknownKeys: string[]
  /** Valid iff every listed key is a known module (missing deps are auto-added, not errors). */
  valid: boolean
}

/** Pull the raw entries out of a `features` Json — accepts `[...]` or `{ modules: [...] }`. */
function rawEntries(features: unknown): unknown[] {
  if (Array.isArray(features)) return features
  if (features && typeof features === 'object' && 'modules' in features) {
    const m = (features as { modules: unknown }).modules
    if (Array.isArray(m)) return m
  }
  return []
}

/** Split a `features` Json into valid optional ModuleKeys vs unknown strings. */
export function parsePlanModules(features: unknown): {
  selected: ModuleKey[]
  unknownKeys: string[]
} {
  const selected: ModuleKey[] = []
  const unknownKeys: string[] = []
  for (const item of rawEntries(features)) {
    if (isModuleKey(item)) {
      if (!ALWAYS_ON.has(item) && !selected.includes(item)) selected.push(item)
    } else {
      unknownKeys.push(String(item))
    }
  }
  return { selected, unknownKeys }
}

/**
 * Validate + resolve a plan's modules from its `features` Json. Enabling a module
 * auto-includes its dependencies; unknown keys make the plan invalid (`valid:false`).
 */
export function resolveBillingPlanModules(features: unknown): PlanModuleResolution {
  const { selected, unknownKeys } = parsePlanModules(features)
  const resolved = resolveModules(selected)
  const selectedSet = new Set<ModuleKey>(selected)
  const autoAdded = resolved.filter((k) => !ALWAYS_ON.has(k) && !selectedSet.has(k))
  return { selected, resolved, autoAdded, unknownKeys, valid: unknownKeys.length === 0 }
}

/**
 * Build a canonical `features` value for storing a plan: the dependency-complete
 * optional surface (deps resolved in, always-on core excluded). Use at plan
 * create/update / seed so the stored set is never missing a dependency.
 */
export function buildBillingPlanFeatures(selected: ModuleKey[]): { modules: ModuleKey[] } {
  return { modules: resolveModules(selected).filter((k) => !ALWAYS_ON.has(k)) }
}
