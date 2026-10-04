import { describe, expect, it } from 'vitest'
import { type Action, can } from '../src/auth/can.js'
import type { AccessClaims } from '../src/auth/tokens.js'

/**
 * Agency manager role (20-А, MOD-4): a manager is internal staff who sees and acts on
 * orders/chats/clients, but is denied finance / settings / team-admin. Owner & executor
 * are unaffected by the new restriction — only `manager` is newly blocked.
 */
const AG = 'agency-1'

function member(role: 'owner' | 'manager' | 'executor'): AccessClaims {
  return {
    sub: `${role}-1`,
    email: `${role}@e.com`,
    role: role === 'owner' ? 'owner' : 'executor',
    activeAgencyId: AG,
    activeCompanyId: null,
    agencyMemberships: [{ agencyId: AG, role }],
    memberships: [],
  }
}
const manager = member('manager')
const executor = member('executor')

const ctx = { agencyId: AG }

describe('can() — manager is denied finance/settings/team-admin', () => {
  const blocked: Action[] = [
    'finance.read',
    'finance.write',
    'admin.access',
    'company.update_settings',
    'company.remove_member',
    'credentials.read',
    'executor.invite',
    'executor.deactivate',
    'payment.confirm',
  ]
  for (const action of blocked) {
    it(`manager CANNOT ${action}`, () => {
      expect(can(manager, action, ctx)).toBe(false)
    })
  }

  it('manager block falls back to the session agency when the action has no resource', () => {
    expect(can(manager, 'executor.invite')).toBe(false) // no resource.agencyId → activeAgencyId
  })
})

describe('can() — manager keeps orders/work', () => {
  const allowed: Action[] = [
    'order.create',
    'order.update',
    'order.transition_status',
    'order.assign_executor',
    'invoice.create',
    'order.approve_estimate',
  ]
  for (const action of allowed) {
    it(`manager CAN ${action}`, () => {
      expect(can(manager, action, ctx)).toBe(true)
    })
  }
})

describe('can() — executor is NOT restricted by the manager rule', () => {
  it('executor can still invite executors + confirm payments (only manager is blocked)', () => {
    expect(can(executor, 'executor.invite', ctx)).toBe(true)
    expect(can(executor, 'payment.confirm', ctx)).toBe(true)
  })
})
