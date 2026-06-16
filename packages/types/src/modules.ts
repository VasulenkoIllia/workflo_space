// ============================================================================
// ModuleRegistry — canonical SaaS module graph (MOD-1, ADR-008).
//
// Single source of truth for "what modules exist + how they depend on each
// other". SaaS packaging (plan → enabled modules) is DATA over this graph, not
// a plugin architecture (ADR-008: entitlement-gated monolith).
//
// Canon: docs/adr/008-saas-module-packaging.md (the mermaid dependency graph).
// Drift between this file and the ADR/code is guarded by
// packages/types/tests/module-registry.test.ts (same discipline as enum-drift).
//
// Three classes:
//   core      — spine, always on, cannot be disabled (Auth, Admin, …).
//   work_core — the product itself, always on (Orders, Chat, Files, Team-base).
//   optional  — sold via plans/add-ons, may depend on other modules.
// `core` boolean in ADR == moduleClass !== 'optional' (see isAlwaysOn()).
// ============================================================================

/** Surface (deployable app) a module lives on. Workspace is always provisioned. */
export type AppSurface = 'landing' | 'portal' | 'workspace'

/** Packaging class — drives whether a module can be turned off per plan. */
export type ModuleClass = 'core' | 'work_core' | 'optional'

/** Canonical machine keys for every module in the system. */
export const MODULE_KEYS = [
  // ── core spine (always on) ────────────────────────────────────────────────
  'auth', // 01
  'tenancy', // infra
  'settings', // 13
  'notifications', // 07
  'clients', // 28-base
  'admin', // 20
  'legal_entity', // 20-Д (default entity always provisioned — provisionAgency)
  'search', // 16-scoped
  'reports', // 19-base dashboard
  // ── work-core (always on — this IS the product) ───────────────────────────
  'orders', // 02
  'chat', // 03
  'files', // 04
  'team', // 12-base roster
  // ── optional (plans / add-ons, have dependencies) ─────────────────────────
  'billing', // 05 (incl. 05-ПРОЕКТИ / Project)
  'documents', // 06
  'wallet', // 25
  'loyalty', // 10
  'referral', // 09
  'finance', // 22 (P&L / margin)
  'payouts', // 12 (executor payouts — optional on top of team-base)
  'leads', // 26
  'integrations', // 27
  'support', // 29
  'calendar', // 24
  'leave', // 23
  'bot', // 15 (Telegram)
  'vault', // 17 (credentials)
  'content', // 11 (blog)
  'landing', // 14 (surface — per-plan flag)
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export interface ModuleDefinition {
  /** Machine key (stable; used by featureEnabled/moduleEnabled gates). */
  key: ModuleKey
  /** Canonical module number from the spec (e.g. '05', '20-Д'); '—' for infra. */
  n: string
  /** Human label. */
  name: string
  /** Packaging class. */
  moduleClass: ModuleClass
  /** Modules that MUST be enabled for this one to work (direct edges, ADR-008). */
  dependsOn: ModuleKey[]
  /** Surfaces this module renders on. */
  appSurface: AppSurface[]
}

/**
 * The graph. `dependsOn` mirrors the ADR-008 mermaid edges exactly. core /
 * work_core modules carry no deps (they are the always-on base every plan
 * implicitly includes — see isAlwaysOn / resolveModules).
 */
export const MODULE_REGISTRY: Record<ModuleKey, ModuleDefinition> = {
  // ── core spine ────────────────────────────────────────────────────────────
  auth: {
    key: 'auth',
    n: '01',
    name: 'Auth',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  tenancy: {
    key: 'tenancy',
    n: '—',
    name: 'Tenancy',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['workspace'],
  },
  settings: {
    key: 'settings',
    n: '13',
    name: 'Settings',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  notifications: {
    key: 'notifications',
    n: '07',
    name: 'Notifications',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  clients: {
    key: 'clients',
    n: '28',
    name: 'Client Management',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['workspace'],
  },
  admin: {
    key: 'admin',
    n: '20',
    name: 'Admin Settings',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['workspace'],
  },
  legal_entity: {
    key: 'legal_entity',
    n: '20-Д',
    name: 'Legal Entities',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['workspace'],
  },
  search: {
    key: 'search',
    n: '16',
    name: 'Search',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  reports: {
    key: 'reports',
    n: '19',
    name: 'Reports',
    moduleClass: 'core',
    dependsOn: [],
    appSurface: ['workspace'],
  },
  // ── work-core ─────────────────────────────────────────────────────────────
  orders: {
    key: 'orders',
    n: '02',
    name: 'Orders',
    moduleClass: 'work_core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  chat: {
    key: 'chat',
    n: '03',
    name: 'Chat & Comments',
    moduleClass: 'work_core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  files: {
    key: 'files',
    n: '04',
    name: 'Files',
    moduleClass: 'work_core',
    dependsOn: [],
    appSurface: ['portal', 'workspace'],
  },
  team: {
    key: 'team',
    n: '12',
    name: 'Team & Executors',
    moduleClass: 'work_core',
    dependsOn: [],
    appSurface: ['workspace'],
  },
  // ── optional ──────────────────────────────────────────────────────────────
  billing: {
    key: 'billing',
    n: '05',
    name: 'Billing',
    moduleClass: 'optional',
    dependsOn: ['orders', 'clients'],
    appSurface: ['portal', 'workspace'],
  },
  documents: {
    key: 'documents',
    n: '06',
    name: 'Documents',
    moduleClass: 'optional',
    dependsOn: ['billing', 'legal_entity'],
    appSurface: ['portal', 'workspace'],
  },
  wallet: {
    key: 'wallet',
    n: '25',
    name: 'Wallet',
    moduleClass: 'optional',
    dependsOn: ['billing'],
    appSurface: ['portal', 'workspace'],
  },
  loyalty: {
    key: 'loyalty',
    n: '10',
    name: 'Loyalty',
    moduleClass: 'optional',
    dependsOn: ['billing'],
    appSurface: ['portal', 'workspace'],
  },
  referral: {
    key: 'referral',
    n: '09',
    name: 'Referral',
    moduleClass: 'optional',
    dependsOn: ['billing'],
    appSurface: ['portal', 'workspace'],
  },
  finance: {
    key: 'finance',
    n: '22',
    name: 'Finance & Expenses',
    moduleClass: 'optional',
    dependsOn: ['billing', 'team'],
    appSurface: ['workspace'],
  },
  payouts: {
    key: 'payouts',
    n: '12',
    name: 'Executor Payouts',
    moduleClass: 'optional',
    dependsOn: ['team'],
    appSurface: ['workspace'],
  },
  leads: {
    key: 'leads',
    n: '26',
    name: 'Leads',
    moduleClass: 'optional',
    dependsOn: ['clients'],
    appSurface: ['workspace'],
  },
  integrations: {
    key: 'integrations',
    n: '27',
    name: 'Integrations',
    moduleClass: 'optional',
    dependsOn: ['leads'],
    appSurface: ['workspace'],
  },
  support: {
    key: 'support',
    n: '29',
    name: 'Support',
    moduleClass: 'optional',
    dependsOn: ['chat'],
    appSurface: ['portal', 'workspace'],
  },
  calendar: {
    key: 'calendar',
    n: '24',
    name: 'Calendar',
    moduleClass: 'optional',
    dependsOn: ['notifications'],
    appSurface: ['portal', 'workspace'],
  },
  leave: {
    key: 'leave',
    n: '23',
    name: 'Leave Tracking',
    moduleClass: 'optional',
    dependsOn: ['team'],
    appSurface: ['workspace'],
  },
  bot: {
    key: 'bot',
    n: '15',
    name: 'Telegram Bot',
    moduleClass: 'optional',
    dependsOn: ['notifications'],
    appSurface: ['portal', 'workspace'],
  },
  vault: {
    key: 'vault',
    n: '17',
    name: 'Credentials Vault',
    moduleClass: 'optional',
    dependsOn: ['clients'],
    appSurface: ['portal', 'workspace'],
  },
  content: {
    key: 'content',
    n: '11',
    name: 'Content & Blog',
    moduleClass: 'optional',
    dependsOn: ['landing'],
    appSurface: ['landing', 'workspace'],
  },
  landing: {
    key: 'landing',
    n: '14',
    name: 'Landing',
    moduleClass: 'optional',
    dependsOn: [],
    appSurface: ['landing'],
  },
}

// ── helpers ───────────────────────────────────────────────────────────────

/** Look up a module definition (throws on unknown key — keeps gates honest). */
export function getModule(key: ModuleKey): ModuleDefinition {
  const def = MODULE_REGISTRY[key]
  if (!def) throw new Error(`Unknown module key: ${String(key)}`)
  return def
}

/** True for core / work_core modules — always on for every tenant, not sellable. */
export function isAlwaysOn(key: ModuleKey): boolean {
  return MODULE_REGISTRY[key].moduleClass !== 'optional'
}

/** Keys of every always-on module (core + work_core), in canonical order. */
export const ALWAYS_ON_MODULES: ModuleKey[] = MODULE_KEYS.filter(isAlwaysOn)

/**
 * Full set of modules enabled for a plan that selected `selected` optional
 * modules: always-on base ∪ selection ∪ all transitive dependencies. Returned
 * in canonical MODULE_KEYS order. Use this to materialize a plan's real surface.
 */
export function resolveModules(selected: ModuleKey[]): ModuleKey[] {
  const enabled = new Set<ModuleKey>(ALWAYS_ON_MODULES)
  const visit = (key: ModuleKey): void => {
    if (enabled.has(key)) return
    enabled.add(key)
    for (const dep of MODULE_REGISTRY[key].dependsOn) visit(dep)
  }
  for (const key of selected) visit(key)
  return MODULE_KEYS.filter((k) => enabled.has(k))
}

/**
 * Validate a RAW selection (before auto-resolution): every selected module's
 * direct dependencies must be present (either selected or always-on). Used to
 * reject an invalid plan composition ("Chat without Orders") with a clear list
 * of what's missing, instead of silently auto-adding (that's resolveModules).
 */
export function validateModuleSelection(selected: ModuleKey[]): {
  valid: boolean
  missing: Array<{ module: ModuleKey; requires: ModuleKey }>
} {
  const present = new Set<ModuleKey>([...ALWAYS_ON_MODULES, ...selected])
  const missing: Array<{ module: ModuleKey; requires: ModuleKey }> = []
  for (const key of selected) {
    for (const dep of MODULE_REGISTRY[key].dependsOn) {
      if (!present.has(dep)) missing.push({ module: key, requires: dep })
    }
  }
  return { valid: missing.length === 0, missing }
}

/** Narrowing type guard for untrusted input (e.g. a plan config from the DB). */
export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && value in MODULE_REGISTRY
}
