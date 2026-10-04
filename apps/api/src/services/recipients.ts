import { withTenant } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { dispatchNotification } from './notifications.js'

/**
 * R3 (аудит r6): канонічні аудиторії нотифікацій + fan-out. До цього той самий
 * «load audience → for → dispatchNotification» був скопійований у ~10 місцях
 * (tickets, leave, documents-accept, orderTransition, inboundEmail, outboxWorker)
 * з різницею лише в ролях і виключенні актора. Всі резолвери йдуть через
 * withTenant — в request-контексті це tenant-GUC, у воркері/кроні (ambient
 * runWithSystemContext) — system bypass, тож хелпери працюють з обох боків.
 */

type AgencyRole = 'owner' | 'manager' | 'executor'

/** profileId членів агенції у заданих ролях, опційно мінус актор. */
export async function agencyRoleIds(
  agencyId: string,
  roles: AgencyRole[],
  excludeId?: string
): Promise<string[]> {
  const rows = await withTenant((tx) =>
    tx.agencyMember.findMany({
      where: {
        agencyId,
        role: { in: roles },
        ...(excludeId ? { profileId: { not: excludeId } } : {}),
      },
      select: { profileId: true },
    })
  )
  return rows.map((r) => r.profileId)
}

/** Власники агенції. */
export const agencyOwnerIds = (agencyId: string, excludeId?: string) =>
  agencyRoleIds(agencyId, ['owner'], excludeId)

/** Власники + тімліди (тріаж/приймання/погодження). */
export const agencyReviewerIds = (agencyId: string, excludeId?: string) =>
  agencyRoleIds(agencyId, ['owner', 'manager'], excludeId)

/** Уся команда агенції (owner + manager + executor). */
export const agencyStaffIds = (agencyId: string, excludeId?: string) =>
  agencyRoleIds(agencyId, ['owner', 'manager', 'executor'], excludeId)

/** Учасники компанії клієнта (люди на порталі), опційно мінус актор. */
export async function clientMemberIds(companyId: string, excludeId?: string): Promise<string[]> {
  const rows = await withTenant((tx) =>
    tx.companyMember.findMany({
      where: { companyId, ...(excludeId ? { profileId: { not: excludeId } } : {}) },
      select: { profileId: true },
    })
  )
  return rows.map((r) => r.profileId)
}

type FanOutInput = Omit<Parameters<typeof dispatchNotification>[1], 'profileId'>

/**
 * Fan-out одного повідомлення списку одержувачів: дедуп по profileId, скіп
 * null/undefined і (опційно) актора. dispatchNotification — fire-and-forget,
 * тож fan-out синхронний.
 */
export function fanOut(
  logger: FastifyBaseLogger,
  ids: (string | null | undefined)[],
  input: FanOutInput,
  opts?: { excludeId?: string }
): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || id === opts?.excludeId || seen.has(id)) continue
    seen.add(id)
    dispatchNotification(logger, { profileId: id, ...input })
  }
}
