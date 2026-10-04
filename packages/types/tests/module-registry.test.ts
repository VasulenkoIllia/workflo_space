import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ALWAYS_ON_MODULES,
  MODULE_KEYS,
  MODULE_REGISTRY,
  type ModuleKey,
  getModule,
  isAlwaysOn,
  isModuleKey,
  resolveModules,
  validateModuleSelection,
} from '../src/modules.js'

/**
 * Guards the ModuleRegistry (MOD-1, ADR-008): structural integrity of the
 * dependency graph + the resolve/validate semantics SaaS packaging relies on.
 */

describe('MODULE_REGISTRY structure', () => {
  it('every key maps to a definition whose .key matches', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULE_REGISTRY[key]).toBeDefined()
      expect(MODULE_REGISTRY[key].key).toBe(key)
    }
  })

  it('registry has no keys beyond MODULE_KEYS (and vice versa)', () => {
    expect(Object.keys(MODULE_REGISTRY).sort()).toEqual([...MODULE_KEYS].sort())
  })

  it('every module has a non-empty number and name', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULE_REGISTRY[key].n.length).toBeGreaterThan(0)
      expect(MODULE_REGISTRY[key].name.length).toBeGreaterThan(0)
      expect(MODULE_REGISTRY[key].appSurface.length).toBeGreaterThan(0)
    }
  })

  it('every dependsOn target is a known module key (no dangling edges)', () => {
    for (const key of MODULE_KEYS) {
      for (const dep of MODULE_REGISTRY[key].dependsOn) {
        expect(MODULE_KEYS).toContain(dep)
      }
    }
  })

  it('no module depends on itself', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULE_REGISTRY[key].dependsOn).not.toContain(key)
    }
  })

  it('the dependency graph is acyclic', () => {
    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<ModuleKey, number>(MODULE_KEYS.map((k) => [k, WHITE]))
    const dfs = (key: ModuleKey): boolean => {
      color.set(key, GRAY)
      for (const dep of MODULE_REGISTRY[key].dependsOn) {
        const c = color.get(dep)
        if (c === GRAY) return false // back-edge → cycle
        if (c === WHITE && !dfs(dep)) return false
      }
      color.set(key, BLACK)
      return true
    }
    for (const key of MODULE_KEYS) {
      if (color.get(key) === WHITE) expect(dfs(key), `cycle reachable from ${key}`).toBe(true)
    }
  })

  it('always-on modules only depend on other always-on modules', () => {
    // A core/work_core module that depended on an optional one could not be
    // "always on" — it would break when that optional module is disabled.
    for (const key of ALWAYS_ON_MODULES) {
      for (const dep of MODULE_REGISTRY[key].dependsOn) {
        expect(isAlwaysOn(dep), `${key} (always-on) depends on optional ${dep}`).toBe(true)
      }
    }
  })
})

describe('resolveModules', () => {
  it('returns at least all always-on modules for an empty selection', () => {
    const resolved = resolveModules([])
    for (const k of ALWAYS_ON_MODULES) expect(resolved).toContain(k)
  })

  it('pulls in transitive dependencies (documents → billing → orders+clients + legal_entity)', () => {
    const resolved = resolveModules(['documents'])
    expect(resolved).toEqual(
      expect.arrayContaining(['documents', 'billing', 'legal_entity', 'orders', 'clients'])
    )
  })

  it('result is closed under dependsOn (every enabled module has its deps enabled)', () => {
    const resolved = new Set(resolveModules(['documents', 'integrations', 'support']))
    for (const key of resolved) {
      for (const dep of MODULE_REGISTRY[key].dependsOn) expect(resolved.has(dep)).toBe(true)
    }
  })

  it('preserves canonical MODULE_KEYS order and is deduped', () => {
    const resolved = resolveModules(['wallet', 'wallet', 'billing'])
    const unique = new Set(resolved)
    expect(resolved.length).toBe(unique.size)
    const indices = resolved.map((k) => MODULE_KEYS.indexOf(k))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})

describe('validateModuleSelection', () => {
  it('flags a selection missing a dependency', () => {
    const { valid, missing } = validateModuleSelection(['documents'])
    expect(valid).toBe(false)
    expect(missing).toEqual(expect.arrayContaining([{ module: 'documents', requires: 'billing' }]))
  })

  it('accepts a selection that includes its dependencies', () => {
    expect(validateModuleSelection(['billing', 'documents']).valid).toBe(true)
  })

  it('treats always-on deps as satisfied (support needs chat, which is work-core)', () => {
    expect(validateModuleSelection(['support']).valid).toBe(true)
  })
})

describe('guards', () => {
  it('isModuleKey narrows known keys and rejects junk', () => {
    expect(isModuleKey('billing')).toBe(true)
    expect(isModuleKey('not_a_module')).toBe(false)
    expect(isModuleKey(42)).toBe(false)
  })

  it('getModule throws on unknown key', () => {
    expect(() => getModule('nope' as ModuleKey)).toThrow()
  })
})

describe('ADR-008 drift guard', () => {
  // The ADR mermaid graph is canon; this catches an edge added to the ADR but
  // not to the registry (and surfaces module numbers that fell out of the doc).
  const ADR_PATH = fileURLToPath(
    new URL('../../../docs/adr/008-saas-module-packaging.md', import.meta.url)
  )
  const adr = readFileSync(ADR_PATH, 'utf8')

  it('every optional module number appears in the ADR text', () => {
    for (const key of MODULE_KEYS) {
      const def = MODULE_REGISTRY[key]
      if (def.moduleClass !== 'optional' || def.n === '—') continue
      // strip the sub-letter (e.g. 20-Д → 20) for a tolerant contains-check
      const base = def.n.split('-')[0]
      expect(adr.includes(base), `module ${def.n} (${def.name}) not referenced in ADR-008`).toBe(
        true
      )
    }
  })
})
