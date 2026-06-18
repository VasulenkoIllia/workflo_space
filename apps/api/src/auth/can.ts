import {
  type AccessClaims,
  type CompanyPermissions,
  isAgencyManager,
  isInternalTeam,
} from './tokens.js'

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
  | 'order.approve_estimate'
  | 'billing.view'
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

/**
 * Member-permission-gated actions → the CompanyPermissions flag that grants
 * them to a non-owner member. Owners always pass; members pass only if the
 * flag is true in their CompanyMember.permissions. (Audit D1.)
 */
const PERMISSION_GATED: Partial<Record<Action, keyof CompanyPermissions>> = {
  'billing.view': 'can_view_billing',
  'company.invite_member': 'can_invite_members',
  'order.approve_estimate': 'can_approve_estimates',
}

export interface ResourceContext {
  agencyId?: string
  companyId?: string
  ownerId?: string
  executorId?: string
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''

/**
 * Actions an agency `manager` (20-А, MOD-4) may NOT do: finance, agency/company
 * settings, team administration, ownership, credentials, and money confirmation. A
 * manager sees orders/chats/clients and acts on them, but the books and the knobs stay
 * with the owner. Owner/executor are unaffected by this set (only `manager` is denied).
 */
const MANAGER_BLOCKED: ReadonlySet<Action> = new Set<Action>([
  'finance.read',
  'finance.write',
  'admin.access',
  'company.update_settings',
  'company.remove_member',
  'company.transfer_ownership',
  'credentials.read',
  'credentials.update',
  'executor.invite',
  'executor.deactivate',
  'payment.confirm',
])

function membershipRole(
  user: AccessClaims,
  companyId: string | undefined
): 'owner' | 'member' | null {
  if (!companyId) return null
  const m = user.memberships.find((x) => x.companyId === companyId)
  return m?.role ?? null
}

/**
 * Owner of the company → always true. Non-owner member → true only if the
 * given permission flag is set. Non-member → false.
 */
function hasCompanyPermission(
  user: AccessClaims,
  companyId: string | undefined,
  flag: keyof CompanyPermissions
): boolean {
  if (!companyId) return false
  const m = user.memberships.find((x) => x.companyId === companyId)
  if (!m) return false
  if (m.role === 'owner') return true
  return m.permissions?.[flag] === true
}

/**
 * Tenant-guard (ADR-004): a resource carrying `agencyId` may only be acted on by
 * a user whose session tenant (activeAgencyId) or agency membership matches it.
 * Resources without agencyId are not tenant-scoped, so this imposes no constraint.
 */
function sameTenant(user: AccessClaims, resourceAgencyId: string): boolean {
  if (user.activeAgencyId === resourceAgencyId) return true
  return user.agencyMemberships.some((m) => m.agencyId === resourceAgencyId)
}

/**
 * Decide whether `user` may perform `action` on `resource`.
 * Default-deny: anything not explicitly allowed returns false.
 */
export function can(user: AccessClaims, action: Action, resource: ResourceContext = {}): boolean {
  // ── Tenant isolation (ADR-004): cross-tenant access is denied before any
  //    feature-level rule. Closes agency-to-agency IDOR by default. ──
  if (resource.agencyId && !sameTenant(user, resource.agencyId)) {
    return false
  }

  // ── Agency manager (20-А, MOD-4): denied the finance/settings/team-admin set,
  //    even though they are internal staff. Falls back to the session agency when the
  //    action carries no resource agencyId (e.g. executor.invite). Owner/executor skip. ──
  if (
    MANAGER_BLOCKED.has(action) &&
    isAgencyManager(user, resource.agencyId ?? user.activeAgencyId ?? undefined)
  ) {
    return false
  }

  // ── Platform admin (hardcoded for MVP; becomes a real role with task #24) ──
  if (action === 'admin.access' || action.startsWith('finance.')) {
    return isInternalTeam(user) && !!ADMIN_EMAIL && user.email === ADMIN_EMAIL
  }

  // ── Ownership transfer: only the company owner ──
  if (action === 'company.transfer_ownership') {
    return membershipRole(user, resource.companyId) === 'owner'
  }

  // ── Credentials: owner-only (executors never see client credentials) ──
  if (action === 'credentials.read' || action === 'credentials.update') {
    return membershipRole(user, resource.companyId) === 'owner'
  }

  // ── Member-permission-gated actions (owner always; member if flag set) ──
  const gateFlag = PERMISSION_GATED[action]
  if (gateFlag) {
    // Internal executors act on any company's orders/estimates, but billing.view
    // is company-scoped only — executors still need a membership for it.
    if (isInternalTeam(user) && action !== 'billing.view') return true
    return hasCompanyPermission(user, resource.companyId, gateFlag)
  }

  // ── Company management: owner-only ──
  if (action === 'company.update_settings' || action === 'company.remove_member') {
    return membershipRole(user, resource.companyId) === 'owner'
  }

  // ── Executor management: platform side (executor role) ──
  if (action === 'executor.invite' || action === 'executor.deactivate') {
    return isInternalTeam(user)
  }

  // ── Orders / invoices / payments ──
  if (
    action.startsWith('order.') ||
    action.startsWith('invoice.') ||
    action.startsWith('payment.')
  ) {
    // Internal team (executors) can operate on any order.
    if (isInternalTeam(user)) return true
    // Clients/members: only within a company they belong to.
    return membershipRole(user, resource.companyId) !== null
  }

  return false // default deny
}
