import { prisma } from '@workflo/db'
import { notify } from '@workflo/notifications'
import { INTERNAL_TO_CLIENT_STATUS, type OrderInternalStatus } from '@workflo/types'
import type { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { captureException } from '../observability/sentry.js'
import { buildNotifyDeps } from './notifications.js'
import { type OutboxEventView, type OutboxHandler, processOutboxBatch } from './outbox.js'

/**
 * Outbox drain worker (audit T-D1). The transactional outbox (S1.6) is durable
 * but inert until something drains it; `transitionOrderStatus` already enqueues
 * `order.status_changed` in prod, so without this loop those events pile up and
 * clients never get notified. One instance loop (single-replica today) calls
 * `processOutboxBatch` on a timer; FOR UPDATE SKIP LOCKED makes it multi-replica
 * safe when we scale. Lifecycle is owned by the bootstrap (index.ts), not
 * `buildApp()`, so tests never start a real loop.
 *
 * Handlers MUST be idempotent: a crash between handler success and the `done`
 * write re-delivers the event (at-least-once). Today's notify-on-status is
 * acceptable to repeat; richer dedup (idempotency-key) is a documented follow-up.
 */
const DRAIN_INTERVAL_MS = 5000

const statusChangedPayload = z.object({
  orderId: z.string(),
  from: z.string(),
  to: z.string(),
  actorId: z.string(),
})

/** `order.status_changed` → notify the order's client members of the new client status. */
async function handleOrderStatusChanged(
  logger: FastifyBaseLogger,
  event: OutboxEventView
): Promise<void> {
  const p = statusChangedPayload.parse(event.payload)

  // Only notify when the CLIENT-facing status actually changed — internal churn
  // (clarification↔estimating) maps to the same client status, so stays silent.
  const clientTo = INTERNAL_TO_CLIENT_STATUS[p.to as OrderInternalStatus]
  const clientFrom = INTERNAL_TO_CLIENT_STATUS[p.from as OrderInternalStatus]
  if (!clientTo || clientFrom === clientTo) return

  const order = await prisma.order.findUnique({
    where: { id: p.orderId },
    select: { agencyId: true, title: true, companyId: true },
  })
  if (!order?.companyId) return
  // Defense-in-depth: the worker runs without a request tenant-context, so assert
  // the loaded order belongs to the event's tenant — never fan out cross-tenant.
  if (event.agencyId && order.agencyId !== event.agencyId) {
    logger.error(
      { orderId: p.orderId, eventAgencyId: event.agencyId, orderAgencyId: order.agencyId },
      'outbox: order/event tenant mismatch — skipping notify'
    )
    return
  }

  const recipients = await prisma.companyMember.findMany({
    where: { companyId: order.companyId, profileId: { not: p.actorId } },
    select: { profileId: true },
  })
  if (recipients.length === 0) return

  const deps = buildNotifyDeps(logger)
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
  for (const r of recipients) {
    await notify(deps, {
      profileId: r.profileId,
      event: 'orders.status_changed',
      vars: {
        orderTitle: order.title,
        orderUrl: `${portalUrl}/tasks/${p.orderId}`,
        newClientStatus: clientTo,
      },
      inApp: { title: 'Оновлення замовлення', body: `«${order.title}» — новий статус` },
    })
  }
}

/** Route a claimed event to its handler. Unknown type → throw → retried → DLQ (visible, not dropped). */
export function buildDispatch(logger: FastifyBaseLogger): OutboxHandler {
  return async (event: OutboxEventView) => {
    switch (event.type) {
      case 'order.status_changed':
        await handleOrderStatusChanged(logger, event)
        return
      default:
        throw new Error(`outbox: no handler for type "${event.type}"`)
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null
let draining = false

export function startOutboxWorker(logger: FastifyBaseLogger): void {
  if (timer) return
  const dispatch = buildDispatch(logger)
  timer = setInterval(() => {
    if (draining) return // never overlap batches
    draining = true
    processOutboxBatch(prisma, dispatch)
      .then((r) => {
        if (r.processed || r.failed || r.dead) logger.info(r, 'outbox: batch drained')
      })
      .catch((err: unknown) => {
        logger.error({ err }, 'outbox: drain failed')
        captureException(err, { scope: 'outbox.drain' })
      })
      .finally(() => {
        draining = false
      })
  }, DRAIN_INTERVAL_MS)
  timer.unref()
  logger.info('outbox worker started')
}

export function stopOutboxWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
