import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyRequest } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'

export interface OrderAccess {
  orderId: string
  agencyId: string
  /** Nullable: `Order.company` is `onDelete: SetNull`, and internal orders may have none. */
  companyId: string | null
  /** true = internal team (executor); false = client (company member). */
  isInternal: boolean
}

/**
 * Load an order and assert the caller may participate in it (chat, reads, files).
 * The single source of truth for order-level IDOR across sub-resources:
 *
 *  - executor (internal team): any order in their tenant;
 *  - client: only orders of a company they belong to — otherwise `404` so the
 *    order's existence isn't leaked to a sibling tenant company.
 *
 * Tenant-guarded (ADR-004). A missing / soft-deleted / un-stamped order is `404`.
 */
export async function requireOrderParticipant(
  request: FastifyRequest,
  orderId: string
): Promise<OrderAccess> {
  const user = request.user
  const notFound = () => new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, agencyId: true, companyId: true, deletedAt: true },
  })
  if (!order || order.deletedAt || !order.agencyId) throw notFound()
  const agencyId = order.agencyId // narrowed string; survives the calls below
  assertSameTenant(user, agencyId)

  const isInternal = user.role === 'executor'
  if (!isInternal && !user.memberships.some((m) => m.companyId === order.companyId)) {
    throw notFound() // same tenant, different company → hide
  }

  return { orderId: order.id, agencyId, companyId: order.companyId, isInternal }
}
