import type { AccessClaims } from './tokens.js'

/**
 * RBAC shim (ADR-002). Centralizes all authz decisions behind a single
 * `can(user, action, resource)` call so the future full RBAC is a drop-in
 * replacement of this file — handlers/services stay unchanged.
 */

export type Action =
  | 'order.create'
  | 'order.update'
  | 'order.delete'
  | 'order.transition_status'
  | 'order.assign_executor'
  | 'invoice.create'
  | 'invoice.send'
  | 'invoice.cancel'
  | 'payment.confirm'
  | 'company.update_settings'
  | 'company.transfer_ownership'
  | 'company.invite_member'
  | 'company.remove_member'
  | 'executor.invite'
  | 'executor.deactivate'
  | 'credentials.read'
  | 'credentials.update'
  | 'finance.read'
  | 'finance.write'
  | 'admin.access'

export interface ResourceContext {
  companyId?: string
  ownerId?: string
  executorId?: string
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''

function membershipRole(
  user: AccessClaims,
  companyId: string | undefined
): 'owner' | 'member' | null {
  if (!companyId) return null
  const m = user.memberships.find((x) => x.companyId === companyId)
  return m?.role ?? null
}

/**
 * Decide whether `user` may perform `action` on `resource`.
 * Default-deny: anything not explicitly allowed returns false.
 */
export function can(user: AccessClaims, action: Action, resource: ResourceContext = {}): boolean {
  // ── Platform admin (hardcoded for MVP; becomes a real role with task #24) ──
  if (action === 'admin.access' || action.startsWith('finance.')) {
    return user.role === 'executor' && !!ADMIN_EMAIL && user.email === ADMIN_EMAIL
  }

  // ── Ownership transfer: only the company owner ──
  if (action === 'company.transfer_ownership') {
    return membershipRole(user, resource.companyId) === 'owner'
  }

  // ── Credentials: owner-only (executors never see client credentials) ──
  if (action === 'credentials.read' || action === 'credentials.update') {
    return membershipRole(user, resource.companyId) === 'owner'
  }

  // ── Company management: owner-only ──
  if (
    action === 'company.update_settings' ||
    action === 'company.invite_member' ||
    action === 'company.remove_member'
  ) {
    return membershipRole(user, resource.companyId) === 'owner'
  }

  // ── Executor management: platform side (executor role) ──
  if (action === 'executor.invite' || action === 'executor.deactivate') {
    return user.role === 'executor'
  }

  // ── Orders / invoices / payments ──
  if (
    action.startsWith('order.') ||
    action.startsWith('invoice.') ||
    action.startsWith('payment.')
  ) {
    // Internal team (executors) can operate on any order.
    if (user.role === 'executor') return true
    // Clients/members: only within a company they belong to.
    return membershipRole(user, resource.companyId) !== null
  }

  return false // default deny
}
