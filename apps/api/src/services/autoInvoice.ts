import { type Prisma, prisma } from '@workflo/db'
import { notify } from '@workflo/notifications'
import type { FastifyBaseLogger } from 'fastify'
import { nextDocumentNumber } from '../routes/documents/documents.js'
import { buildNotifyDeps } from './notifications.js'

/**
 * АВТО-РАХУНОК (рішення власника 07.07): разове замовлення перейшло в done →
 * ЧЕРНЕТКА рахунку (draft) + in-app власникам «перевір і надішли». Клієнту нічого
 * не летить — відправка лишається ручним кроком (send-флоу з PDF).
 *
 * Скоуп свідомо вузький: замовлення БЕЗ проекту (проектні білляться циклами
 * recurringCharges) і з компанією. Сума: fixed → approvedAmount ?? fixedPrice ??
 * totalAmount; hourly → Σ TimeLog.hours × hourlyRate (факт, не оцінка — рішення
 * власника). Немає суми/годин → рахунок не створюється, власник отримує in-app
 * з причиною. Ідемпотентність: наявний invoice/advance_invoice по замовленню =
 * вже виставлено, виходимо мовчки (ретрай outbox-події не дублює).
 *
 * Викликається з outbox-воркера (system-контекст) — збій ковтається викликачем,
 * щоб не перезапускати доставку сповіщень про статус.
 */
export async function maybeAutoInvoiceOnDone(
  logger: FastifyBaseLogger,
  orderId: string,
  actorId: string
): Promise<'created' | 'skipped' | 'no_amount'> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      agencyId: true,
      companyId: true,
      projectId: true,
      title: true,
      billingType: true,
      fixedPrice: true,
      approvedAmount: true,
      totalAmount: true,
      hourlyRate: true,
      internalStatus: true,
      deletedAt: true,
      project: { select: { legalEntityId: true } },
    },
  })
  if (!order || order.deletedAt || order.internalStatus !== 'done') return 'skipped'
  if (!order.companyId || order.projectId) return 'skipped'

  const agency = await prisma.agency.findUnique({
    where: { id: order.agencyId },
    select: { autoInvoiceOneTime: true },
  })
  if (!agency?.autoInvoiceOneTime) return 'skipped'

  const existing = await prisma.document.findFirst({
    where: { orderId: order.id, type: { in: ['invoice', 'advance_invoice'] } },
    select: { id: true },
  })
  if (existing) return 'skipped'

  const owners = await prisma.agencyMember.findMany({
    where: { agencyId: order.agencyId, role: 'owner' },
    select: { profileId: true },
  })
  const deps = buildNotifyDeps(logger)
  const workspaceUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
  const orderUrl = `${workspaceUrl}/orders/${order.id}`

  // Сума до виставлення
  let amount: Prisma.Decimal | null = null
  if (order.billingType === 'hourly') {
    if (order.hourlyRate != null) {
      const agg = await prisma.timeLog.aggregate({
        where: { orderId: order.id },
        _sum: { hours: true },
      })
      const hours = agg._sum.hours
      if (hours != null && hours.greaterThan(0)) amount = hours.mul(order.hourlyRate)
    }
  } else {
    amount = order.approvedAmount ?? order.fixedPrice ?? order.totalAmount
  }

  if (amount == null || !amount.greaterThan(0)) {
    // Немає з чого виставляти — власник вирішує вручну (подія без email-шаблону → in-app).
    for (const o of owners) {
      await notify(deps, {
        profileId: o.profileId,
        event: 'billing.invoice_draft_ready',
        vars: { orderTitle: order.title, number: null, orderUrl },
        inApp: {
          title: 'Авто-рахунок не створено',
          body:
            order.billingType === 'hourly'
              ? `«${order.title}» — немає залогованих годин або ставки`
              : `«${order.title}» — не задано суму замовлення`,
        },
      })
    }
    return 'no_amount'
  }

  const companyId = order.companyId
  const year = new Date().getUTCFullYear()
  const document = await prisma.$transaction(async (tx) => {
    const legalEntityId =
      order.project?.legalEntityId ??
      (
        await tx.legalEntity.findFirst({
          where: { agencyId: order.agencyId, isDefault: true },
          select: { id: true },
        })
      )?.id ??
      null
    const number = await nextDocumentNumber(tx, order.agencyId, 'invoice', year)
    return tx.document.create({
      data: {
        agency: { connect: { id: order.agencyId } },
        type: 'invoice',
        number,
        order: { connect: { id: order.id } },
        company: { connect: { id: companyId } },
        ...(legalEntityId ? { legalEntity: { connect: { id: legalEntityId } } } : {}),
        status: 'draft', // чернетка — власник перевіряє і надсилає сам
        createdBy: { connect: { id: actorId } },
      },
      select: { id: true, number: true },
    })
  })

  // PDF рахунку читає суму з замовлення — hourly-факт стільки не має, доштампуємо.
  if (order.totalAmount == null) {
    await prisma.order.update({ where: { id: order.id }, data: { totalAmount: amount } })
  }

  for (const o of owners) {
    await notify(deps, {
      profileId: o.profileId,
      event: 'billing.invoice_draft_ready',
      vars: { orderTitle: order.title, number: document.number, orderUrl },
      inApp: {
        title: 'Рахунок готовий до відправки',
        body: `${document.number} · «${order.title}» на ${amount.toFixed(2)} — перевір і надішли`,
      },
    })
  }
  logger.info(
    { orderId: order.id, number: document.number },
    'auto-invoice: draft created on order done'
  )
  return 'created'
}
