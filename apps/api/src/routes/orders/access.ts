import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyRequest } from 'fastify'
import { getPermissions, orderScopeWhere } from '../../auth/permissions.js'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

/**
 * PERM-4: скоуп команди — замовлення має покриватися правом `orders.view` (all — будь-яке;
 * team — підрозділ тімліда; own — призначене мені чи моя задача). Непокрите → 404, щоб не
 * світити існування (як для клієнта чужої компанії).
 */
export async function assertTeamScope(
  request: FastifyRequest,
  orderId: string,
  orderAgencyId: string
): Promise<void> {
  const notFound = new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
  const snap = await getPermissions(request)
  if (!snap || snap.agencyId !== orderAgencyId) throw notFound
  const where = orderScopeWhere(snap, snap.levels['orders.view'], request.user.sub)
  if (where === null) throw notFound
  if (Object.keys(where).length === 0) return
  const visible = await withTenant((tx) => tx.order.count({ where: { id: orderId, ...where } }))
  if (visible === 0) throw notFound
}

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
 *  - internal team: orders covered by `orders.view` (PERM-4: all / team / own);
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

  const order = await withTenant((tx) =>
    tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, agencyId: true, companyId: true, deletedAt: true },
    })
  )
  if (!order || order.deletedAt || !order.agencyId) throw notFound()
  const agencyId = order.agencyId // narrowed string; survives the calls below
  assertSameTenant(user, agencyId)

  const isInternal = isInternalTeam(user)
  if (!isInternal && !user.memberships.some((m) => m.companyId === order.companyId)) {
    throw notFound() // same tenant, different company → hide
  }
  if (isInternal) await assertTeamScope(request, order.id, agencyId)

  return { orderId: order.id, agencyId, companyId: order.companyId, isInternal }
}

/**
 * Guard for WORKSPACE-only order sub-resources (internal tasks, time logs):
 * the caller must be internal team (executor) and the order must live in their
 * tenant. Returns the resolved tenant `agencyId` for downstream stamping.
 */
export async function requireTeamOrder(
  request: FastifyRequest,
  orderId: string
): Promise<{ orderId: string; agencyId: string }> {
  const user = request.user
  if (!isInternalTeam(user)) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
  }
  const order = await withTenant((tx) =>
    tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, agencyId: true, deletedAt: true },
    })
  )
  if (!order || order.deletedAt) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Замовлення не знайдено', 404)
  }
  assertSameTenant(user, order.agencyId)
  await assertTeamScope(request, order.id, order.agencyId)
  // Return the ORDER's agency (the resource), not the actor's active agency — they
  // differ for a multi-agency user, and downstream stamps / assignee-membership
  // checks must bind to the order's tenant (R-3 / Phase 1 IDOR).
  return { orderId: order.id, agencyId: order.agencyId }
}
