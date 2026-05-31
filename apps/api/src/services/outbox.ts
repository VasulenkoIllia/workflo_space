import type { PrismaClient } from '@workflo/db'

/**
 * Transactional outbox (ADR topic #2-3). Producers enqueue a domain event in
 * the SAME transaction as the state change; a worker drains the queue later, so
 * delivery (notify / webhook / search-index) survives crashes and gets retried.
 *
 * S1.6 ships the durable queue + drain state-machine. Concrete handlers (notify,
 * webhooks) and the cron/worker loop are wired in their own sprints (S6+).
 */

export interface OutboxInput {
  type: string
  payload: unknown
  agencyId?: string | null
}

/** Enqueue an event. Pass a tx client to enroll it in the producer's transaction. */
export async function enqueueOutbox(
  tx: Pick<PrismaClient, 'outboxEvent'>,
  input: OutboxInput
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      type: input.type,
      payload: input.payload as object,
      agencyId: input.agencyId ?? null,
    },
  })
}

/** Exponential backoff (ms) with a 1h cap: 30s, 60s, 120s, … */
export function backoffMs(attempts: number): number {
  const ms = 30_000 * 2 ** Math.max(0, attempts - 1)
  return Math.min(ms, 60 * 60 * 1000)
}

export interface OutboxEventView {
  id: string
  type: string
  payload: unknown
  agencyId: string | null
}

export type OutboxHandler = (event: OutboxEventView) => Promise<void>

interface ClaimedRow extends OutboxEventView {
  attempts: number
  maxAttempts: number
}

/**
 * Drain one batch of due events. Rows are claimed with FOR UPDATE SKIP LOCKED so
 * concurrent workers never double-process. Each handler success → done; failure
 * → retried with backoff, or moved to the DLQ (status='dead') once attempts
 * reach maxAttempts.
 */
export async function processOutboxBatch(
  prisma: PrismaClient,
  handler: OutboxHandler,
  opts: { limit?: number; now?: Date } = {}
): Promise<{ processed: number; failed: number; dead: number }> {
  const limit = opts.limit ?? 20
  const now = opts.now ?? new Date()

  const claimed = await prisma.$queryRaw<ClaimedRow[]>`
    UPDATE "outbox_events"
    SET "status" = 'processing'
    WHERE "id" IN (
      SELECT "id" FROM "outbox_events"
      WHERE "status" IN ('pending', 'failed') AND "nextAttemptAt" <= ${now}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "payload", "agencyId", "attempts", "maxAttempts"
  `

  let processed = 0
  let failed = 0
  let dead = 0

  for (const ev of claimed) {
    try {
      await handler({ id: ev.id, type: ev.type, payload: ev.payload, agencyId: ev.agencyId })
      await prisma.outboxEvent.update({
        where: { id: ev.id },
        data: {
          status: 'done',
          attempts: ev.attempts + 1,
          processedAt: new Date(),
          lastError: null,
        },
      })
      processed++
    } catch (err) {
      const attempts = ev.attempts + 1
      const isDead = attempts >= ev.maxAttempts
      await prisma.outboxEvent.update({
        where: { id: ev.id },
        data: {
          status: isDead ? 'dead' : 'failed',
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
          nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
        },
      })
      if (isDead) dead++
      else failed++
    }
  }

  return { processed, failed, dead }
}
