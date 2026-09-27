import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  clampLevel,
  matrixRole,
  resolvePermissions,
  setPermissionSchema,
} from '../src/permissions.js'

const base = { roleRows: [], memberRows: [] }

describe('PERM-1 resolvePermissions', () => {
  it('owner — завжди all на все, персональні/рольові відхилення ігноруються', () => {
    const p = resolvePermissions({
      agencyRole: 'owner',
      isLead: false,
      roleRows: [{ role: 'manager', permission: 'billing.view', level: 'none' }],
      memberRows: [{ permission: 'billing.view', level: 'none' }],
    })
    for (const def of PERMISSIONS) expect(p[def.key]).toBe('all')
  })

  it('дефолти рішення власника 27.09: менеджер без фінансів, але веде клієнтів/команду', () => {
    const m = resolvePermissions({ agencyRole: 'manager', isLead: false, ...base })
    expect(m['billing.view']).toBe('none')
    expect(m['finance.view']).toBe('none')
    expect(m['payouts.view_team']).toBe('none')
    expect(m['clients.view']).toBe('all')
    expect(m['leads.manage']).toBe('all')
    expect(m['team.invite']).toBe('all')
    expect(m['orders.accept']).toBe('all')
  })

  it('виконавець — лише своя робота; тімлід — приймання й KPI свого підрозділу', () => {
    const x = resolvePermissions({ agencyRole: 'executor', isLead: false, ...base })
    expect(x['orders.view']).toBe('own')
    expect(x['orders.accept']).toBe('none')
    expect(x['orders.delete']).toBe('none')
    expect(x['team.invite']).toBe('none')
    expect(x['billing.view']).toBe('none')
    const l = resolvePermissions({ agencyRole: 'executor', isLead: true, ...base })
    expect(matrixRole('executor', true)).toBe('lead')
    expect(l['orders.accept']).toBe('team')
    expect(l['team.kpi']).toBe('team')
    expect(l['payouts.view_team']).toBe('none')
  })

  it('персональне право > рядок матриці > дефолт', () => {
    const p = resolvePermissions({
      agencyRole: 'manager',
      isLead: false,
      roleRows: [
        { role: 'manager', permission: 'billing.view', level: 'all' },
        { role: 'manager', permission: 'leads.manage', level: 'none' },
        { role: 'executor', permission: 'content.manage', level: 'all' }, // інша роль — ігнор
      ],
      memberRows: [{ permission: 'billing.view', level: 'none' }],
    })
    expect(p['billing.view']).toBe('none') // персональне відкликання перемагає матрицю
    expect(p['leads.manage']).toBe('none') // матриця перемагає дефолт
    expect(p['content.manage']).toBe('none') // рядок executor не впливає на manager
  })

  it('рівень клемпиться до дозволених для права', () => {
    expect(clampLevel('billing.view', 'team')).toBe('none') // BIN: лише none/all
    expect(clampLevel('orders.accept', 'own')).toBe('none') // TEAMED
    expect(clampLevel('vault.access', 'team')).toBe('own') // OWNED
    expect(clampLevel('orders.view', 'team')).toBe('team')
  })

  it('контракт: невідоме право й невідомий рівень — 400', () => {
    expect(setPermissionSchema.safeParse({ permission: 'nope.x', level: 'all' }).success).toBe(
      false
    )
    expect(
      setPermissionSchema.safeParse({ permission: 'billing.view', level: 'godmode' }).success
    ).toBe(false)
    expect(setPermissionSchema.safeParse({ permission: 'billing.view', level: null }).success).toBe(
      true
    )
  })

  it('каталог: унікальні ключі, дефолт кожної ролі — серед дозволених рівнів', () => {
    const keys = PERMISSIONS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const p of PERMISSIONS) {
      for (const r of ['manager', 'lead', 'executor'] as const) {
        expect(p.levels as readonly string[], `${p.key}/${r}`).toContain(p.defaults[r])
      }
    }
  })
})
