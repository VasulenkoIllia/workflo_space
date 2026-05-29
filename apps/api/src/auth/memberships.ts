import type { PrismaClient } from '@workflo/db'
import type { CompanyPermissions, Membership } from './tokens.js'

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
    permissions: (m.permissions as CompanyPermissions | null) ?? undefined,
  }))
}

/** First membership's company is the default active company (null if none). */
export function defaultActiveCompanyId(memberships: Membership[]): string | null {
  return memberships[0]?.companyId ?? null
}
