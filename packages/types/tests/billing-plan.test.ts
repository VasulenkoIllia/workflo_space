import { describe, expect, it } from 'vitest'
import {
  buildBillingPlanFeatures,
  parsePlanModules,
  resolveBillingPlanModules,
} from '../src/billing-plan.js'
import { ALWAYS_ON_MODULES, isAlwaysOn } from '../src/modules.js'

/**
 * BillingPlan.modules validator + resolver (MOD-3, ADR-008). Enabling a module
 * auto-includes its graph dependencies; unknown keys are reported, always-on core is
 * never stored. `documents` depends on `billing` (+ always-on `legal_entity`).
 */
describe('parsePlanModules', () => {
  it('parses the canonical { modules: [...] } shape', () => {
    const r = parsePlanModules({ modules: ['finance', 'wallet'] })
    expect(r.selected).toEqual(['finance', 'wallet'])
    expect(r.unknownKeys).toEqual([])
  })

  it('accepts a bare string[] (legacy/shorthand)', () => {
    const r = parsePlanModules(['finance', 'wallet'])
    expect(r.selected).toEqual(['finance', 'wallet'])
  })

  it('reports unknown keys instead of keeping them', () => {
    const r = parsePlanModules(['finance', 'not-a-module', '5 активних замовлень'])
    expect(r.selected).toEqual(['finance'])
    expect(r.unknownKeys).toEqual(['not-a-module', '5 активних замовлень'])
  })

  it('drops always-on modules (not sellable) and dedupes', () => {
    const r = parsePlanModules(['orders', 'finance', 'finance', 'auth'])
    expect(r.selected).toEqual(['finance']) // orders/auth are always-on → excluded
    expect(r.unknownKeys).toEqual([])
  })

  it('a non-array / non-object / malformed features yields an empty selection', () => {
    expect(parsePlanModules(null).selected).toEqual([])
    expect(parsePlanModules('finance').selected).toEqual([])
    expect(parsePlanModules({ modules: null }).selected).toEqual([]) // botched seed
    expect(parsePlanModules({ modules: 'finance' }).selected).toEqual([]) // scalar, not array
    expect(parsePlanModules({}).selected).toEqual([])
  })
})

describe('resolveBillingPlanModules', () => {
  it('auto-adds graph dependencies (documents → billing)', () => {
    const r = resolveBillingPlanModules({ modules: ['documents'] })
    expect(r.valid).toBe(true)
    expect(r.selected).toEqual(['documents'])
    expect(r.resolved).toContain('documents')
    expect(r.resolved).toContain('billing') // pulled in as a dependency
    expect(r.autoAdded).toContain('billing')
    expect(r.autoAdded).not.toContain('documents') // explicitly selected, not auto-added
  })

  it('always-on core is always part of resolved, never of selected/autoAdded', () => {
    const r = resolveBillingPlanModules({ modules: ['finance'] })
    for (const k of ALWAYS_ON_MODULES) expect(r.resolved).toContain(k)
    expect(r.selected.some(isAlwaysOn)).toBe(false)
    expect(r.autoAdded.some(isAlwaysOn)).toBe(false)
  })

  it('an unknown key makes the plan invalid', () => {
    const r = resolveBillingPlanModules({ modules: ['finance', 'bogus'] })
    expect(r.valid).toBe(false)
    expect(r.unknownKeys).toEqual(['bogus'])
    expect(r.selected).toEqual(['finance']) // valid part still resolves
  })

  it('an empty selection resolves to exactly the always-on core', () => {
    const r = resolveBillingPlanModules({ modules: [] })
    expect(r.resolved).toEqual([...ALWAYS_ON_MODULES])
    expect(r.autoAdded).toEqual([])
  })
})

describe('buildBillingPlanFeatures', () => {
  it('stores the dependency-complete optional surface, excluding always-on', () => {
    const f = buildBillingPlanFeatures(['documents'])
    expect(f.modules).toContain('documents')
    expect(f.modules).toContain('billing') // dependency included
    expect(f.modules.some(isAlwaysOn)).toBe(false) // always-on never stored
  })

  it('round-trips: a built features value is valid and resolves consistently', () => {
    const f = buildBillingPlanFeatures(['documents', 'finance'])
    const r = resolveBillingPlanModules(f)
    expect(r.valid).toBe(true)
    expect(r.unknownKeys).toEqual([])
    expect(r.resolved).toContain('documents')
    expect(r.resolved).toContain('billing')
    expect(r.resolved).toContain('finance')
  })

  it('an empty selection stores no optional modules', () => {
    expect(buildBillingPlanFeatures([]).modules).toEqual([])
  })
})
