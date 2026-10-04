import type { Prisma } from '@workflo/db'

/**
 * S12-07: одержувачі розсилки — ВЛАСНИКИ компаній сегмента (дедуп по профілю).
 * Сегменти: all — усі компанії агенції; debtors — moneyBalance < 0 (борг);
 * tier — loyalty-тір компанії. Спільний резолвер для preview-роуту і воркера.
 */
export async function resolveBroadcastRecipients(
  tx: Pick<Prisma.TransactionClient, 'companyMember'>,
  agencyId: string,
  segment: 'all' | 'debtors' | 'tier',
  tier: string | null
): Promise<string[]> {
  const companyFilter: Record<string, unknown> = { agencyId }
  if (segment === 'debtors') companyFilter.moneyBalance = { lt: 0 }
  if (segment === 'tier' && tier) companyFilter.loyaltyTier = tier

  const members = await tx.companyMember.findMany({
    where: { role: 'owner', company: companyFilter },
    select: { profileId: true },
  })
  return [...new Set(members.map((m) => m.profileId))]
}
