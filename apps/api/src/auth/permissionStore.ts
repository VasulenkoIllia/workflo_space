import { prisma } from '@workflo/db'
import type { PermissionLevel, PermissionRole } from '@workflo/types'

/**
 * PERM-1: сирі дані для резолвера прав — ОКРЕМИЙ модуль, щоб юніт-тести з мокнутим Prisma
 * підміняли його глобально (tests/setup/permissionStore.mock.ts → «чисті дефолти»), а
 * інтеграційні (RUN_DB_TESTS=1) ходили в реальну БД. Resolver — `auth/permissions.ts`.
 */
export interface PermissionData {
  /** Підрозділи, де людина — тімлід (Team.leadId) → роль матриці `lead` для executor. */
  leadTeamIds: string[]
  /** Підрозділ людини (AgencyMember.teamId) — для рівня `team`. */
  teamId: string | null
  /** Відхилення матриці ролей агенції (усі ролі — таблиця крихітна). */
  roleRows: { role: PermissionRole; permission: string; level: PermissionLevel }[]
  /** Персональні гранти/відкликання цієї людини. */
  memberRows: { permission: string; level: PermissionLevel }[]
}

export async function fetchPermissionData(
  agencyId: string,
  profileId: string
): Promise<PermissionData> {
  const [leadTeams, member, roleRows, memberRows] = await Promise.all([
    prisma.team.findMany({ where: { agencyId, leadId: profileId }, select: { id: true } }),
    prisma.agencyMember.findUnique({
      where: { agencyId_profileId: { agencyId, profileId } },
      select: { teamId: true },
    }),
    prisma.agencyRolePermission.findMany({
      where: { agencyId },
      select: { role: true, permission: true, level: true },
    }),
    prisma.agencyMemberPermission.findMany({
      where: { agencyId, profileId },
      select: { permission: true, level: true },
    }),
  ])
  return {
    leadTeamIds: leadTeams.map((t) => t.id),
    teamId: member?.teamId ?? null,
    roleRows,
    memberRows,
  }
}
