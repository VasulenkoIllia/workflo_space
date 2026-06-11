import { prisma, runWithSystemContext } from '@workflo/db'
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
  // AR-32 (audit 2026-06-11): notify() never throws — it reports per-channel
  // outcomes. Previously we ignored them, so an SMTP/Telegram outage marked the
  // event done and the notification was lost FOREVER. Now: a recipient whose
  // every attempted channel failed counts as undelivered; if NO recipient got
  // anything, throw → the outbox loop redelivers with backoff (→ DLQ after max
  // attempts). Partial delivery does NOT retry (at-least-once would double-send
  // the recipients that succeeded) — it is logged instead.
  let attemptedTotal = 0
  let deliveredRecipients = 0
  let failedRecipients = 0
  let maxRetryAfterSec = 0
  for (const r of recipients) {
    const outcome = await notify(deps, {
      profileId: r.profileId,
      event: 'orders.status_changed',
      vars: {
        orderTitle: order.title,
        orderUrl: `${portalUrl}/tasks/${p.orderId}`,
        newClientStatus: clientTo,
      },
      inApp: { title: 'Оновлення замовлення', body: `«${order.title}» — новий статус` },
    })
    const attempted = outcome.results.filter((res) => res.result.status !== 'skipped')
    attemptedTotal += attempted.length
    if (attempted.length === 0) continue // no enabled channels → nothing to deliver
    const failures = attempted.filter((res) => res.result.status === 'failed')
    if (failures.length === attempted.length) {
      failedRecipients += 1
      for (const f of failures) {
        const fr = f.result as { reason?: string; retryAfter?: number }
        if (fr.reason === 'rate_limited' && typeof fr.retryAfter === 'number') {
          maxRetryAfterSec = Math.max(maxRetryAfterSec, fr.retryAfter)
        }
      }
    } else {
      deliveredRecipients += 1
    }
  }

  if (failedRecipients > 0 && deliveredRecipients === 0 && attemptedTotal > 0) {
    // Honor Telegram's retryAfter as a floor hint in the error (the outbox backoff
    // is coarser, but the next attempt will land after the rate window anyway).
    throw new Error(
      `outbox: notify failed for all ${failedRecipients} recipient(s) of order ${p.orderId}` +
        (maxRetryAfterSec > 0 ? ` (rate_limited, retryAfter=${maxRetryAfterSec}s)` : '')
    )
  }
  if (failedRecipients > 0) {
    logger.warn(
      { orderId: p.orderId, deliveredRecipients, failedRecipients },
      'outbox: partial notify delivery (will NOT retry — successes would double-send)'
    )
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
    // System context (review fix, S5.5): the timer callback has no request ALS, and
    // the notify facade routes DB I/O through withTenant — without an explicit
    // bypass context every event would fail-closed the day RLS_ENFORCED flips.
    runWithSystemContext(() => processOutboxBatch(prisma, dispatch))
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
