import type { PrismaClient } from '@workflo/db'
import { type AgencyMembership, coercePermissions, type Membership } from './tokens.js'

/**
 * Load a profile's company memberships (with permission flags) in the stable
 * order used everywhere — by joinedAt asc. Shared by login / refresh / me so
 * the claims shape (and the activeCompanyId heuristic) lives in one place.
 */
export async function loadMemberships(
  prisma: Pick<PrismaClient, 'companyMember'>,
  profileId: string
): Promise<Membership[]> {
  const rows = await prisma.companyMember.findMany({
    where: { profileId },
    select: { companyId: true, role: true, permissions: true },
    orderBy: { joinedAt: 'asc' },
  })

  return rows.map((m) => ({
    companyId: m.companyId,
    role: m.role,
    permissions: coercePermissions(m.permissions),
  }))
}

/** First membership's company is the default active company (null if none). */
export function defaultActiveCompanyId(memberships: Membership[]): string | null {
  return memberships[0]?.companyId ?? null
}

/**
 * Load a profile's agency (tenant) memberships — internal team only (ADR-004).
 * Stable order by createdAt asc, mirroring company memberships.
 */
export async function loadAgencyMemberships(
  prisma: Pick<PrismaClient, 'agencyMember'>,
  profileId: string
): Promise<AgencyMembership[]> {
  const rows = await prisma.agencyMember.findMany({
    where: { profileId },
    select: { agencyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((m) => ({ agencyId: m.agencyId, role: m.role }))
}

/**
 * Pick the active agency for a staffer: honour a `preferred` agency (the one they
 * last chose via /auth/switch-agency) IF it's still a current membership, else
 * fall back to the first. Makes the session tenant deterministic AND switchable,
 * instead of silently "whichever row sorts first" (audit P4).
 */
export function pickActiveAgencyId(
  agencyMemberships: AgencyMembership[],
  preferred?: string | null
): string | null {
  if (preferred && agencyMemberships.some((m) => m.agencyId === preferred)) {
    return preferred
  }
  return agencyMemberships[0]?.agencyId ?? null
}

/**
 * The active tenant of a session: an internal team member operates in their
 * agency (honouring their last switch-agency choice, `preferredAgencyId`); a
 * client's tenant is derived from their active company's agencyId.
 */
export async function resolveActiveAgencyId(
  prisma: Pick<PrismaClient, 'company'>,
  params: {
    agencyMemberships: AgencyMembership[]
    activeCompanyId: string | null
    preferredAgencyId?: string | null
  }
): Promise<string | null> {
  if (params.agencyMemberships.length > 0) {
    return pickActiveAgencyId(params.agencyMemberships, params.preferredAgencyId)
  }
  if (params.activeCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: params.activeCompanyId },
      select: { agencyId: true },
    })
    return company?.agencyId ?? null
  }
  return null
}
