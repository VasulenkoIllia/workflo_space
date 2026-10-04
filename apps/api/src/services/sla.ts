import type { Prisma } from '@workflo/db'
import type { OrderPriority } from '@workflo/types'

/**
 * S10-02 SLA (спека 02-orders §C): дедлайни реакції обчислюються ПРИ СТВОРЕННІ замовлення
 * з політики агенції для його пріоритету. Немає політики — немає SLA (обидва дедлайни null,
 * cron таке замовлення не чіпає). Зміна політики заднім числом наявні замовлення не
 * перештамповує — свідомо (нові правила = нові замовлення).
 */
export async function slaDueDates(
  tx: Pick<Prisma.TransactionClient, 'slaPolicy'>,
  agencyId: string,
  priority: OrderPriority | string,
  now: Date = new Date()
): Promise<{ firstResponseDueAt: Date | null; resolutionDueAt: Date | null }> {
  const policy = await tx.slaPolicy.findFirst({
    where: { agencyId, priority: priority as OrderPriority },
    select: { firstResponseMins: true, resolutionMins: true },
  })
  if (!policy) return { firstResponseDueAt: null, resolutionDueAt: null }
  return {
    firstResponseDueAt: new Date(now.getTime() + policy.firstResponseMins * 60_000),
    resolutionDueAt: new Date(now.getTime() + policy.resolutionMins * 60_000),
  }
}
