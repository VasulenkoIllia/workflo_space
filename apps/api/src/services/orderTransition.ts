import { type Prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyBaseLogger } from 'fastify'
import { dispatchNotification } from './notifications.js'

/**
 * R1 (аудит r6): бізнес-логіка переходу статусу замовлення, винесена з
 * routes/orders/transitionOrderStatus.ts — гейти старту, дефолт settlements при
 * закритті та нотифікаційні фан-аути. Роут лишає собі parse/auth/guarded-write.
 * Поведінка 1:1 з дорефакторним кодом; кожен блок зберігає свій історичний коментар.
 */

// Форма замовлення, яку вантажить роут (підмножина, потрібна гейтам/нотифікаціям).
export interface TransitionOrderRow {
  id: string
  agencyId: string
  companyId: string | null
  title: string
  requiresApproval: boolean
  approvalStatus: string | null
  acceptedAt: Date | null
  assigneeId: string | null
  submittedById: string | null
  coAssignees: { profileId: string }[]
  project: { billingModel: string; contractRequired: boolean } | null
  company: { moneyBalance: Prisma.Decimal } | null
}

/**
 * Гейти старту роботи (перехід → in_progress), у канонічному порядку:
 * 02-А погодження оцінки → S10-03 блокери-залежності → 02-В аванс → 06-договір.
 * Кидає AppError 409 на першому невиконаному гейті.
 */
export async function assertStartGates(order: TransitionOrderRow): Promise<void> {
  // 02-А: when the order requires estimate approval, work cannot start until the
  // client has approved. approvalStatus is monotonic (only the client moves it to
  // approved/rejected, never back), so the snapshot check is race-free for this gate.
  if (order.requiresApproval && order.approvalStatus !== 'approved') {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'Оцінку ще не погоджено клієнтом — старт роботи заблоковано',
      409
    )
  }

  // S10-03 (02-D): заблоковане замовлення не стартує, поки ВСІ блокери не
  // done (cancelled- АБО soft-deleted-блокер вважаємо знятим — він уже нічого
  // не завершить; без deletedAt-фільтра видалений in_progress-блокер дедлочив
  // залежне назавжди — audit-H1 2026-07-12).
  const liveBlockers = await withTenant((tx) =>
    tx.orderDependency.findMany({
      where: {
        orderId: order.id,
        dependsOn: { deletedAt: null, internalStatus: { notIn: ['done', 'cancelled'] } },
      },
      select: { dependsOn: { select: { title: true } } },
      take: 5,
    })
  )
  if (liveBlockers.length > 0) {
    const names = liveBlockers.map((b) => `«${b.dependsOn.title}»`).join(', ')
    throw new AppError(
      ApiErrorCode.CONFLICT,
      `Заблоковано залежностями: ${names} — спершу заверши їх`,
      409
    )
  }

  // 02-В advance gate (owner decision: hourly_prepaid only, moneyBalance discipline):
  // a prepaid project bills the advance at cycle start, which drives moneyBalance
  // negative; work on its orders can't start while the client still owes (balance < 0),
  // i.e. the advance is unpaid. Once the advance lands the balance returns to ≥ 0 and the
  // order may start — exactly the «чекаємо аванс» behavior, with no extra schema.
  if (order.project?.billingModel === 'hourly_prepaid' && order.company?.moneyBalance.lessThan(0)) {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'Очікується аванс — у клієнта непогашений борг, старт роботи заблоковано',
      409
    )
  }

  // 06-ПІДПИС договір-гейт (рішення власника 06.07, тумблер агенції): без
  // ПРИЙНЯТОГО клієнтом договору робота не стартує. Рамкова семантика: будь-який
  // accepted-договір цієї КОМПАНІЇ (не per-order). Внутрішні замовлення без
  // компанії гейт не чіпає.
  // 06-ДОГОВІР-2 каскад (рішення 06.07): проект має пріоритет — effective =
  // project.contractRequired ?? agency.requireSignedContract. Проект явно
  // «без договору» → старт-гейт його замовлення не чіпає; проект «з договором» →
  // гейт діє навіть без агентського тумблера.
  if (order.companyId) {
    let effectiveRequire: boolean
    if (order.project) {
      effectiveRequire = order.project.contractRequired
    } else {
      const agency = await withTenant((tx) =>
        tx.agency.findUnique({
          where: { id: order.agencyId },
          select: { requireSignedContract: true },
        })
      )
      effectiveRequire = agency?.requireSignedContract ?? false
    }
    if (effectiveRequire) {
      const contract = await withTenant((tx) =>
        tx.document.findFirst({
          where: { companyId: order.companyId ?? '', type: 'contract', status: 'accepted' },
          select: { id: true },
        })
      )
      if (!contract) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Немає прийнятого договору з клієнтом — старт роботи заблоковано (вимога агенції)',
          409
        )
      }
    }
  }
}

/**
 * ПРИЙМАННЯ: при закритті фіксуємо оплатні години дефолтом = факт для тих виконавців,
 * кого owner/manager ще не звірив вручну (payableHours=trackedHours). Наявні звірки
 * (виставлені через /reconciliation) не чіпаємо. Викликається ВСЕРЕДИНІ транзакції
 * переходу — дефолти комітяться разом зі зміною статусу.
 */
export async function defaultSettlementsOnDone(
  tx: Prisma.TransactionClient,
  order: { id: string; agencyId: string }
): Promise<void> {
  const existing = await tx.orderExecutorSettlement.findMany({
    where: { orderId: order.id },
    select: { profileId: true },
  })
  const have = new Set(existing.map((e) => e.profileId))
  const groups = await tx.timeLog.groupBy({
    by: ['executorId'],
    where: { orderId: order.id },
    _sum: { hours: true },
  })
  const toCreate = groups.filter((g) => !have.has(g.executorId) && g._sum.hours != null)
  if (toCreate.length > 0) {
    await tx.orderExecutorSettlement.createMany({
      data: toCreate.map((g) => ({
        agencyId: order.agencyId,
        orderId: order.id,
        profileId: g.executorId,
        trackedHours: g._sum.hours ?? 0,
        payableHours: g._sum.hours ?? 0,
      })),
    })
  }
}

/**
 * ПРИЙМАННЯ: адресні in-app нотифікації навколо приймання (окремо від клієнтських,
 * що йдуть через outbox-worker за зміною clientStatus). Актор виключається;
 * дедуп по profileId.
 */
export async function notifyAcceptanceTransition(
  logger: FastifyBaseLogger,
  args: {
    order: TransitionOrderRow
    actorId: string
    kind: 'submitted' | 'accepted' | 'sent_back'
    comment: string | null
  }
): Promise<void> {
  const { order, actorId, kind, comment } = args
  const workspaceUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
  const orderUrl = `${workspaceUrl}/orders/${order.id}`
  const notifyOnce = (
    ids: (string | null | undefined)[],
    event: 'orders.submitted_for_acceptance' | 'orders.accepted' | 'orders.sent_back',
    inApp: { title: string; body: string }
  ) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (!id || id === actorId || seen.has(id)) continue
      seen.add(id)
      dispatchNotification(logger, {
        profileId: id,
        event,
        vars: { orderTitle: order.title, orderUrl },
        inApp,
      })
    }
  }
  const coIds = (order.coAssignees ?? []).map((c) => c.profileId)
  if (kind === 'submitted') {
    // здано на приймання → власники + тімліди агенції
    const acceptors = await withTenant((tx) =>
      tx.agencyMember.findMany({
        where: { agencyId: order.agencyId, role: { in: ['owner', 'manager'] } },
        select: { profileId: true },
      })
    )
    notifyOnce(
      acceptors.map((a) => a.profileId),
      'orders.submitted_for_acceptance',
      { title: 'Замовлення на прийманні', body: order.title }
    )
  } else if (kind === 'accepted') {
    notifyOnce([order.submittedById, order.assigneeId, ...coIds], 'orders.accepted', {
      title: 'Роботу прийнято',
      body: order.title,
    })
  } else {
    notifyOnce([order.submittedById, order.assigneeId, ...coIds], 'orders.sent_back', {
      title: 'Повернено на доопрацювання',
      body: comment ? `${order.title} — ${comment}` : order.title,
    })
  }
}

/**
 * S10-03: блокер завершено → залежні, у яких це був ОСТАННІЙ живий блокер,
 * розблоковано — повідом виконавцям (in-app), щоб робота не висіла.
 * (Видалені блокери не рахуються живими — audit-H1.)
 */
export async function notifyUnblockedDependents(
  logger: FastifyBaseLogger,
  order: { id: string; title: string }
): Promise<void> {
  const dependents = await withTenant((tx) =>
    tx.orderDependency.findMany({
      where: { dependsOnId: order.id },
      select: {
        order: {
          select: {
            id: true,
            title: true,
            assigneeId: true,
            coAssignees: { select: { profileId: true } },
            blockedBy: {
              select: { dependsOn: { select: { internalStatus: true, deletedAt: true } } },
            },
          },
        },
      },
    })
  )
  for (const d of dependents) {
    const stillBlocked = d.order.blockedBy.some(
      (b) =>
        b.dependsOn.deletedAt === null &&
        b.dependsOn.internalStatus !== 'done' &&
        b.dependsOn.internalStatus !== 'cancelled'
    )
    if (stillBlocked) continue
    const ids = [d.order.assigneeId, ...d.order.coAssignees.map((c) => c.profileId)]
    const seen = new Set<string>()
    for (const id of ids) {
      if (!id || seen.has(id)) continue
      seen.add(id)
      dispatchNotification(logger, {
        profileId: id,
        event: 'orders.unblocked',
        vars: { orderTitle: d.order.title },
        inApp: {
          title: 'Замовлення розблоковано',
          body: `${d.order.title} — блокер «${order.title}» завершено, можна стартувати.`,
        },
      })
    }
  }
}
