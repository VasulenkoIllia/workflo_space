import { prisma, runWithSystemContext } from '@workflo/db'
import { notify } from '@workflo/notifications'
import {
  INTERNAL_TO_CLIENT_STATUS,
  type NotificationEvent,
  type OrderInternalStatus,
} from '@workflo/types'
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

const orderRefPayload = z.object({
  orderId: z.string(),
  actorId: z.string(),
  comment: z.string().nullable().optional(),
})

/**
 * Per-recipient notify loop with the same at-least-once / partial-delivery semantics as the
 * status handler: throws (→ retry → DLQ) only if EVERY recipient's every attempted channel
 * failed. in_app rows persist regardless (notify() writes them); email/telegram without a
 * template come back `skipped`, so adding events with no email template is safe.
 */
async function deliverToRecipients(
  logger: FastifyBaseLogger,
  recipientProfileIds: string[],
  event: NotificationEvent,
  vars: Record<string, unknown>,
  inApp: { title: string; body: string }
): Promise<void> {
  if (recipientProfileIds.length === 0) return
  const deps = buildNotifyDeps(logger)
  let attemptedTotal = 0
  let delivered = 0
  let failed = 0
  for (const profileId of recipientProfileIds) {
    const outcome = await notify(deps, { profileId, event, vars, inApp })
    const attempted = outcome.results.filter((r) => r.result.status !== 'skipped')
    attemptedTotal += attempted.length
    if (attempted.length === 0) continue
    if (attempted.every((r) => r.result.status === 'failed')) failed += 1
    else delivered += 1
  }
  if (failed > 0 && delivered === 0 && attemptedTotal > 0) {
    throw new Error(`outbox: notify failed for all ${failed} recipient(s) of "${event}"`)
  }
  if (failed > 0) logger.warn({ delivered, failed, event }, 'outbox: partial notify delivery')
}

/** Members of the order's client company (people on the client portal), minus the actor. */
async function clientMemberIds(companyId: string, excludeId: string): Promise<string[]> {
  const rows = await prisma.companyMember.findMany({
    where: { companyId, profileId: { not: excludeId } },
    select: { profileId: true },
  })
  return rows.map((r) => r.profileId)
}

/** Agency owners + managers (triage / oversight), minus the actor. */
async function agencyStaffIds(agencyId: string, excludeId: string): Promise<string[]> {
  const rows = await prisma.agencyMember.findMany({
    where: { agencyId, role: { in: ['owner', 'manager'] }, profileId: { not: excludeId } },
    select: { profileId: true },
  })
  return rows.map((r) => r.profileId)
}

/** Load the order + assert it belongs to the event's tenant; null → don't fan out. */
async function loadOrderForEvent(
  logger: FastifyBaseLogger,
  event: OutboxEventView,
  orderId: string
): Promise<{ agencyId: string; title: string; companyId: string | null } | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { agencyId: true, title: true, companyId: true },
  })
  if (!order) return null
  if (event.agencyId && order.agencyId !== event.agencyId) {
    logger.error(
      { orderId, eventAgencyId: event.agencyId, orderAgencyId: order.agencyId },
      'outbox: order/event tenant mismatch — skip'
    )
    return null
  }
  return order
}

/** `order.approval_requested` (02-А) → ask the client to approve the estimate. */
async function handleApprovalRequested(
  logger: FastifyBaseLogger,
  event: OutboxEventView
): Promise<void> {
  const p = orderRefPayload.parse(event.payload)
  const order = await loadOrderForEvent(logger, event, p.orderId)
  if (!order?.companyId) return
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
  await deliverToRecipients(
    logger,
    await clientMemberIds(order.companyId, p.actorId),
    'orders.status_changed',
    // Full status vars so the email template (S6-07) renders correctly: at this point the
    // order is client-status `pending_approval` (the estimate awaits the client's decision).
    {
      orderTitle: order.title,
      orderUrl: `${portalUrl}/tasks/${p.orderId}`,
      newClientStatus: 'pending_approval',
    },
    {
      title: 'Оцінку надіслано на погодження',
      body: `«${order.title}» — перегляньте й погодьте оцінку`,
    }
  )
}

/** `order.approval_approved` / `order.approval_rejected` → the team learns the client's decision. */
async function handleApprovalDecided(
  logger: FastifyBaseLogger,
  event: OutboxEventView,
  approved: boolean
): Promise<void> {
  const p = orderRefPayload.parse(event.payload)
  const order = await loadOrderForEvent(logger, event, p.orderId)
  if (!order) return
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
  await deliverToRecipients(
    logger,
    await agencyStaffIds(order.agencyId, p.actorId),
    'orders.status_changed',
    // Either decision moves the order to client-status `in_progress` (approved → work starts;
    // rejected → back to estimating, which still maps to in_progress for the client).
    {
      orderTitle: order.title,
      orderUrl: `${portalUrl}/tasks/${p.orderId}`,
      newClientStatus: 'in_progress',
    },
    approved
      ? { title: 'Оцінку погоджено', body: `«${order.title}» — клієнт погодив, можна стартувати` }
      : {
          title: 'Клієнт запросив правки',
          body: `«${order.title}»${p.comment ? ` — ${p.comment}` : ''}`,
        }
  )
}

/** `order.created` → tell the agency team a new order landed (in_app; no email/telegram template). */
async function handleOrderCreated(
  logger: FastifyBaseLogger,
  event: OutboxEventView
): Promise<void> {
  const p = orderRefPayload.parse(event.payload)
  const order = await loadOrderForEvent(logger, event, p.orderId)
  if (!order) return
  await deliverToRecipients(
    logger,
    await agencyStaffIds(order.agencyId, p.actorId),
    'orders.created',
    { orderTitle: order.title },
    { title: 'Нове замовлення', body: `«${order.title}» — нове замовлення` }
  )
}

const assignedPayload = z.object({
  orderId: z.string(),
  executorId: z.string(),
  actorId: z.string(),
})

/** `order.assigned` → tell the executor they were put on the order (in_app). */
async function handleOrderAssigned(
  logger: FastifyBaseLogger,
  event: OutboxEventView
): Promise<void> {
  const p = assignedPayload.parse(event.payload)
  const order = await loadOrderForEvent(logger, event, p.orderId)
  if (!order) return
  await deliverToRecipients(
    logger,
    [p.executorId].filter((id) => id !== p.actorId),
    'orders.assigned',
    { orderTitle: order.title },
    { title: 'Вас призначено виконавцем', body: `«${order.title}» — нове призначення` }
  )
}

const commentPayload = z.object({
  orderId: z.string(),
  authorId: z.string(),
  isInternal: z.boolean(),
  preview: z.string(),
})

/** `order.comment_created` → notify thread participants (chat.new_comment: email + telegram + in_app).
 * Internal notes stay team-only; public comments fan out to team + client, never the author. */
async function handleNewComment(logger: FastifyBaseLogger, event: OutboxEventView): Promise<void> {
  const p = commentPayload.parse(event.payload)
  const order = await loadOrderForEvent(logger, event, p.orderId)
  if (!order) return

  const author = await prisma.profile.findUnique({
    where: { id: p.authorId },
    select: { name: true },
  })
  const authorName = author?.name ?? 'Учасник'
  const team = await agencyStaffIds(order.agencyId, p.authorId)
  const recipients = p.isInternal
    ? team
    : [...team, ...(order.companyId ? await clientMemberIds(order.companyId, p.authorId) : [])]

  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
  await deliverToRecipients(
    logger,
    recipients,
    'chat.new_comment',
    {
      orderTitle: order.title,
      authorName,
      preview: p.preview,
      orderUrl: `${portalUrl}/tasks/${p.orderId}`,
    },
    { title: 'Новий коментар', body: `${authorName} · «${order.title}»` }
  )
}

const documentSentPayload = z.object({
  orderId: z.string(),
  docType: z.string(),
  number: z.string(),
  amount: z.string(),
  dueDate: z.string(),
  actorId: z.string(),
})

/** `document.sent` → tell the client a document was issued. Invoices use the rich
 * billing.invoice_sent email; other types land in_app via the documents category. */
async function handleDocumentSent(
  logger: FastifyBaseLogger,
  event: OutboxEventView
): Promise<void> {
  const p = documentSentPayload.parse(event.payload)
  const order = await loadOrderForEvent(logger, event, p.orderId)
  if (!order?.companyId) return

  const isInvoice = p.docType === 'invoice' || p.docType === 'advance_invoice'
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.workflo.space'
  await deliverToRecipients(
    logger,
    await clientMemberIds(order.companyId, p.actorId),
    isInvoice ? 'billing.invoice_sent' : 'documents.completion_act_ready',
    {
      invoiceNumber: p.number,
      amount: p.amount,
      dueDate: p.dueDate,
      invoiceUrl: `${portalUrl}/tasks/${p.orderId}`,
    },
    {
      title: isInvoice ? 'Виставлено рахунок' : 'Новий документ',
      body: `${p.number} — надіслано`,
    }
  )
}

/** Route a claimed event to its handler. Unknown type → throw → retried → DLQ (visible, not dropped). */
export function buildDispatch(logger: FastifyBaseLogger): OutboxHandler {
  return async (event: OutboxEventView) => {
    switch (event.type) {
      case 'order.status_changed':
        await handleOrderStatusChanged(logger, event)
        return
      case 'order.created':
        await handleOrderCreated(logger, event)
        return
      case 'order.assigned':
        await handleOrderAssigned(logger, event)
        return
      case 'order.comment_created':
        await handleNewComment(logger, event)
        return
      case 'document.sent':
        await handleDocumentSent(logger, event)
        return
      case 'order.approval_requested':
        await handleApprovalRequested(logger, event)
        return
      case 'order.approval_approved':
        await handleApprovalDecided(logger, event, true)
        return
      case 'order.approval_rejected':
        await handleApprovalDecided(logger, event, false)
        return
      case 'charge.approval_approved':
      case 'charge.approval_rejected':
        // Billing-internal: ack so the event leaves the outbox (no DLQ). A client-facing
        // «рахунок виставлено» notification needs a billing NotificationEvent → S6 follow-up.
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
