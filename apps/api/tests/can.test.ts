import { describe, expect, it } from 'vitest'

// can.ts reads ADMIN_EMAIL at module load — set before import.
process.env.ADMIN_EMAIL = 'admin@workflo.space'
const { can } = await import('../src/auth/can.js')
import type { AccessClaims } from '../src/auth/tokens.js'

const owner: AccessClaims = {
  sub: 'p1',
  email: 'owner@example.com',
  role: 'client',
  activeCompanyId: 'c1',
  memberships: [
    { companyId: 'c1', role: 'owner' },
    { companyId: 'c2', role: 'member' },
  ],
}

const executor: AccessClaims = {
  sub: 'e1',
  email: 'exec@example.com',
  role: 'executor',
  activeCompanyId: null,
  memberships: [],
}

const admin: AccessClaims = {
  sub: 'a1',
  email: 'admin@workflo.space',
  role: 'executor',
  activeCompanyId: null,
  memberships: [],
}

describe('can() — RBAC shim', () => {
  it('owner can update settings / transfer / read credentials of OWNED company', () => {
    expect(can(owner, 'company.update_settings', { companyId: 'c1' })).toBe(true)
    expect(can(owner, 'company.transfer_ownership', { companyId: 'c1' })).toBe(true)
    expect(can(owner, 'credentials.read', { companyId: 'c1' })).toBe(true)
  })

  it('member (not owner) cannot do owner-only actions', () => {
    expect(can(owner, 'company.update_settings', { companyId: 'c2' })).toBe(false)
    expect(can(owner, 'credentials.read', { companyId: 'c2' })).toBe(false)
    expect(can(owner, 'company.transfer_ownership', { companyId: 'c2' })).toBe(false)
  })

  it('executor never reads client credentials', () => {
    expect(can(executor, 'credentials.read', { companyId: 'c1' })).toBe(false)
  })

  it('orders/invoices: members of the company allowed, outsiders denied', () => {
    expect(can(owner, 'order.create', { companyId: 'c1' })).toBe(true)
    expect(can(owner, 'order.create', { companyId: 'c2' })).toBe(true) // member still allowed
    expect(can(owner, 'order.create', { companyId: 'other' })).toBe(false)
  })

  it('executor can operate on any order', () => {
    expect(can(executor, 'order.transition_status', { companyId: 'anything' })).toBe(true)
    expect(can(executor, 'payment.confirm', { companyId: 'anything' })).toBe(true)
  })

  it('admin.access + finance.* require the platform admin email', () => {
    expect(can(admin, 'admin.access')).toBe(true)
    expect(can(admin, 'finance.read')).toBe(true)
    expect(can(admin, 'finance.write')).toBe(true)
    expect(can(executor, 'admin.access')).toBe(false) // executor but not admin email
    expect(can(owner, 'finance.read')).toBe(false) // client
  })

  it('executor management requires executor role', () => {
    expect(can(executor, 'executor.invite')).toBe(true)
    expect(can(owner, 'executor.invite')).toBe(false)
  })

  it('defaults to deny for missing companyId / unknown context', () => {
    expect(can(owner, 'order.create', {})).toBe(false)
    expect(can(owner, 'credentials.read', {})).toBe(false)
  })

  // ── D1: member-permission-gated actions ──
  const memberWithBilling: AccessClaims = {
    sub: 'm1',
    email: 'm@e.com',
    role: 'client',
    activeCompanyId: 'c1',
    memberships: [{ companyId: 'c1', role: 'member', permissions: { can_view_billing: true } }],
  }
  const memberNoPerms: AccessClaims = {
    sub: 'm2',
    email: 'm2@e.com',
    role: 'client',
    activeCompanyId: 'c1',
    memberships: [{ companyId: 'c1', role: 'member', permissions: {} }],
  }

  it('billing.view: owner always; member only with can_view_billing', () => {
    expect(can(owner, 'billing.view', { companyId: 'c1' })).toBe(true) // owner of c1
    expect(can(memberWithBilling, 'billing.view', { companyId: 'c1' })).toBe(true)
    expect(can(memberNoPerms, 'billing.view', { companyId: 'c1' })).toBe(false)
  })

  it('company.invite_member honors can_invite_members for members', () => {
    expect(can(owner, 'company.invite_member', { companyId: 'c1' })).toBe(true) // owner
    expect(can(memberNoPerms, 'company.invite_member', { companyId: 'c1' })).toBe(false)
    const inviter: AccessClaims = {
      ...memberNoPerms,
      memberships: [{ companyId: 'c1', role: 'member', permissions: { can_invite_members: true } }],
    }
    expect(can(inviter, 'company.invite_member', { companyId: 'c1' })).toBe(true)
  })

  it('executor passes order-level permission gates but NOT company-scoped billing.view', () => {
    expect(can(executor, 'order.approve_estimate', { companyId: 'anything' })).toBe(true)
    expect(can(executor, 'billing.view', { companyId: 'anything' })).toBe(false)
  })
})
