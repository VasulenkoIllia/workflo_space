import { withTenant } from '@workflo/db'
import { isAgencyOwner, requireActiveAgency } from '../auth/tenant.js'
import { type AccessClaims, isAgencyManager, isInternalTeam } from '../auth/tokens.js'

/**
 * 17-SHARE: what part of a company's vault the current user may READ (list + reveal).
 *
 *  - agency owner   → everything ('owner')
 *  - agency manager → nothing (MANAGER_BLOCKED canon — books & keys stay with the owner)
 *  - executor       → the union of their ACTIVE shares: a company-level share (companyId set)
 *                     opens ALL secrets of that client incl. future ones; point shares open
 *                     individual credentials. Active = not revoked and not expired (expiresAt
 *                     is spec-compat: nothing issues it yet, but the check honors it).
 *
 * Write paths (create/revoke/delete/journal/share-management) stay owner-only — this scope
 * is deliberately read-side only.
 */
export type VaultScope =
  | { kind: 'owner' }
  | { kind: 'all' }
  | { kind: 'subset'; credentialIds: string[] }

/** Read-scope of `user` over `companyId`'s vault; null = no access at all. */
export async function resolveVaultScope(
  user: AccessClaims,
  companyId: string
): Promise<VaultScope | null> {
  const agencyId = requireActiveAgency(user)
  if (isAgencyOwner(user, agencyId)) return { kind: 'owner' }
  if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) return null

  const now = new Date()
  const shares = await withTenant((tx) =>
    tx.credentialShare.findMany({
      where: {
        agencyId,
        executorId: user.sub,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        companyId: true,
        credentialId: true,
        credential: { select: { companyId: true } },
      },
    })
  )
  if (shares.some((s) => s.companyId === companyId)) return { kind: 'all' }
  const credentialIds = shares
    .filter((s) => s.credentialId != null && s.credential?.companyId === companyId)
    .map((s) => s.credentialId as string)
  return credentialIds.length > 0 ? { kind: 'subset', credentialIds } : null
}

/** True when the scope covers one specific credential (for the reveal gate). */
export function scopeCoversCredential(scope: VaultScope | null, credId: string): boolean {
  if (scope == null) return false
  if (scope.kind === 'owner' || scope.kind === 'all') return true
  return scope.credentialIds.includes(credId)
}

/** The executor's cross-client share map (for the global /vault view):
 * company ids opened wholesale + individual credential ids. */
export async function executorShareMap(
  user: AccessClaims
): Promise<{ companyIds: string[]; credentialIds: string[] } | null> {
  const agencyId = requireActiveAgency(user)
  if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) return null
  const now = new Date()
  const shares = await withTenant((tx) =>
    tx.credentialShare.findMany({
      where: {
        agencyId,
        executorId: user.sub,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { companyId: true, credentialId: true },
    })
  )
  return {
    companyIds: [...new Set(shares.flatMap((s) => (s.companyId ? [s.companyId] : [])))],
    credentialIds: [...new Set(shares.flatMap((s) => (s.credentialId ? [s.credentialId] : [])))],
  }
}
