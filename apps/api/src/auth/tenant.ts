import { ApiErrorCode, AppError } from '@workflo/types'
import type { AccessClaims } from './tokens.js'

/**
 * Tenant-scoping helpers (ADR-004). **MANDATORY for every agency-scoped query in
 * S2+** so a forgotten `where` can never become a cross-tenant leak. The enforcement
 * is structural, not per-handler discipline (audit 31.05). Three tools:
 *
 *  - `tenantWhere(agencyId, extra)` — merge the tenant filter into a Prisma `where`.
 *  - `tenantData(agencyId, data)`   — stamp the tenant onto a `create` payload.
 *    Always derive `agencyId` from the actor's SESSION (requireActiveAgency), never
 *    from a client-supplied field.
 *  - `assertSameTenant(user, resourceAgencyId)` — 403 if a freshly-loaded resource
 *    belongs to another tenant (the resource-fetch counterpart of can()'s guard).
 */

type TenantClaims = Pick<AccessClaims, 'activeAgencyId' | 'agencyMemberships'>

/** Merge the mandatory `agencyId` filter into a Prisma where-clause. */
export function tenantWhere<T extends object>(
  agencyId: string,
  extra?: T
): T & { agencyId: string } {
  return { ...(extra ?? ({} as T)), agencyId }
}

/** Stamp the tenant onto a create payload (agencyId from session, not client). */
export function tenantData<T extends object>(agencyId: string, data: T): T & { agencyId: string } {
  return { ...data, agencyId }
}

/** Resolve the tenant a request operates in; 403 if the session carries none. */
export function requireActiveAgency(user: TenantClaims): string {
  if (!user.activeAgencyId) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає активної агенції', 403)
  }
  return user.activeAgencyId
}

/** True if the user is an OWNER of the given agency (not merely a member/executor). */
export function isAgencyOwner(
  user: Pick<AccessClaims, 'agencyMemberships'>,
  agencyId: string
): boolean {
  return user.agencyMemberships.some((m) => m.agencyId === agencyId && m.role === 'owner')
}

/**
 * R6 (аудит r6): активна агенція + owner-гейт одним викликом — 403 з доменним
 * повідомленням, якщо користувач не власник. До цього ~20 роут-файлів тримали
 * ідентичні локальні assertOwner-клозури, що різнились лише текстом помилки.
 */
export function requireOwnerAgency(
  user: TenantClaims,
  message = 'Доступно лише власнику агенції'
): string {
  const agencyId = requireActiveAgency(user)
  if (!isAgencyOwner(user, agencyId)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, message, 403)
  }
  return agencyId
}

/**
 * Throw 403 unless the resource's agency is the caller's tenant. A null
 * `resourceAgencyId` is denied (a legacy / un-stamped row is invisible to every
 * tenant by design — safer to refuse than to leak).
 */
export function assertSameTenant(user: TenantClaims, resourceAgencyId: string | null): void {
  const ok =
    resourceAgencyId !== null &&
    (user.activeAgencyId === resourceAgencyId ||
      user.agencyMemberships.some((m) => m.agencyId === resourceAgencyId))
  if (!ok) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ заборонено', 403)
  }
}
