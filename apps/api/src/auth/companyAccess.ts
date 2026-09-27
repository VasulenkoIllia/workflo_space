import type { AccessClaims, CompanyPermissions } from './tokens.js'

/**
 * PORTAL-MEMBER: чи бачить клієнт суми компанії. Власник компанії — завжди; учасник — з
 * `can_view_billing` або `can_approve_estimates` (погодити кошторис без сум неможливо).
 */
export function clientSeesMoney(
  user: Pick<AccessClaims, 'memberships'>,
  companyId: string | null | undefined
): boolean {
  const m = user.memberships.find((x) => x.companyId === companyId)
  if (!m) return false
  if (m.role === 'owner') return true
  const p: CompanyPermissions = m.permissions ?? {}
  return p.can_view_billing === true || p.can_approve_estimates === true
}

/** Учасник бачить грошові документи (рахунки, звірки, місячні звіти) лише з can_view_billing. */
export function clientSeesBillingDocs(
  user: Pick<AccessClaims, 'memberships'>,
  companyId: string | null | undefined
): boolean {
  const m = user.memberships.find((x) => x.companyId === companyId)
  if (!m) return false
  return m.role === 'owner' || m.permissions?.can_view_billing === true
}
