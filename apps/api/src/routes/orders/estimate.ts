import { Prisma, prisma, tenantTransaction, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { writeAuditAsync } from '../../services/audit.js'
import { requireTeamOrder } from './access.js'

/**
 * 02-Б КОШТОРИС разового замовлення (рішення власника 07.07): позиції к-сть × ціна
 * (з каталогу послуг або вільним рядком). Σ позицій АВТОМАТИЧНО стає fixedPrice
 * замовлення (одне джерело правди: погодження клієнтом, авто-рахунок і PDF бачать
 * ту саму цифру). Друкується лише у СПЕЦИФІКАЦІЇ (довільний формат); рахунок/акт
 * друкують номенклатуру. PUT = bulk-replace; порожній масив = прибрати кошторис
 * (fixedPrice не чіпається — сума лишається останньою погодженою).
 */
const lineSchema = z
  .object({
    serviceId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(255),
    qty: z.number().positive().max(9999),
    unitPrice: z.number().min(0).max(99_999_999),
  })
  .strict()
const putSchema = z.object({ lines: z.array(lineSchema).max(50) }).strict()

const LINE_SELECT = {
  id: true,
  serviceId: true,
  name: true,
  qty: true,
  unitPrice: true,
  position: true,
} as const

function total(lines: { qty: Prisma.Decimal; unitPrice: Prisma.Decimal }[]): Prisma.Decimal {
  return lines.reduce((acc, l) => acc.add(l.qty.mul(l.unitPrice)), new Prisma.Decimal(0))
}

const orderEstimateRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: { orderId: string } }>(
    '/orders/:orderId/estimate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { orderId } = await requireTeamOrder(request, request.params.orderId)
      const lines = await withTenant((tx) =>
        tx.orderEstimateLine.findMany({
          where: { orderId },
          orderBy: { position: 'asc' },
          select: LINE_SELECT,
        })
      )
      return reply.send({
        success: true,
        data: { lines, total: total(lines).toFixed(2) },
      })
    }
  )

  fastify.put<{ Params: { orderId: string } }>(
    '/orders/:orderId/estimate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { agencyId, orderId } = await requireTeamOrder(request, request.params.orderId)
      const body = putSchema.parse(request.body)

      const order = await withTenant((tx) =>
        tx.order.findUnique({
          where: { id: orderId },
          select: { approvalStatus: true },
        })
      )
      // 02-А: кошторис = оцінка — на погодженні/погоджену не переписуємо (як updateOrder)
      if (order?.approvalStatus === 'pending' || order?.approvalStatus === 'approved') {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          'Оцінку на погодженні не можна змінювати — дочекайтеся рішення клієнта',
          409
        )
      }

      // Каталожні посилання мають належати агенції (вільні рядки — без serviceId)
      const serviceIds = [
        ...new Set(body.lines.map((l) => l.serviceId).filter((x): x is string => x != null)),
      ]
      if (serviceIds.length > 0) {
        const found = await withTenant((tx) =>
          tx.service.count({ where: { id: { in: serviceIds }, agencyId } })
        )
        if (found !== serviceIds.length) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Невідома послуга в кошторисі', 400)
        }
      }

      const result = await tenantTransaction(prisma, async (tx) => {
        await tx.orderEstimateLine.deleteMany({ where: { orderId } })
        if (body.lines.length > 0) {
          await tx.orderEstimateLine.createMany({
            data: body.lines.map((l, i) => ({
              agencyId,
              orderId,
              serviceId: l.serviceId ?? null,
              name: l.name,
              qty: l.qty,
              unitPrice: l.unitPrice,
              position: i,
            })),
          })
        }
        const lines = await tx.orderEstimateLine.findMany({
          where: { orderId },
          orderBy: { position: 'asc' },
          select: LINE_SELECT,
        })
        const sum = total(lines)
        // Σ → fixedPrice (bulk-replace непорожнього кошторису); порожній — суму не чіпаємо
        if (lines.length > 0) {
          await tx.order.update({
            where: { id: orderId },
            data: { billingType: 'fixed', fixedPrice: sum, totalAmount: sum },
          })
        }
        return { lines, sum }
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'order.estimate_updated',
        resourceType: 'order',
        resourceId: orderId,
        result: 'allowed',
        metadata: { lines: body.lines.length, total: result.sum.toFixed(2) },
      })
      return reply.send({
        success: true,
        data: { lines: result.lines, total: result.sum.toFixed(2) },
      })
    }
  )

  return Promise.resolve()
}

export default orderEstimateRoute
