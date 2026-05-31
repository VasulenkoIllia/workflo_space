import type { PrismaClient } from '@workflo/db'
import { z } from 'zod'

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
  payload: Record<string, unknown>
  agencyId?: string | null
}

/** Visibility lease: how long a claimed ('processing') row is hidden before a
 *  crashed worker's row becomes re-claimable (implicit reaper). */
const VISIBILITY_TIMEOUT_MS = 10 * 60 * 1000

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

// Raw-query results are untyped at runtime — validate the shape so a column
// rename / driver change surfaces as a clear error, not silent NaN arithmetic
// in the retry loop (audit 31.05).
const claimedRowSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.unknown(),
  agencyId: z.string().nullable(),
  attempts: z.number().int(),
  maxAttempts: z.number().int(),
})
type ClaimedRow = z.infer<typeof claimedRowSchema>

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

  // Claiming pushes nextAttemptAt into the future (a lease) and bumps attempts
  // atomically. Including 'processing' rows whose lease has lapsed makes a crashed
  // worker's stranded rows self-heal — no separate reaper query/column (audit 31.05).
  const leaseUntil = new Date(now.getTime() + VISIBILITY_TIMEOUT_MS)
  const rawRows = await prisma.$queryRaw`
    UPDATE "outbox_events"
    SET "status" = 'processing', "attempts" = "attempts" + 1, "nextAttemptAt" = ${leaseUntil}
    WHERE "id" IN (
      SELECT "id" FROM "outbox_events"
      WHERE "status" IN ('pending', 'failed', 'processing') AND "nextAttemptAt" <= ${now}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "payload", "agencyId", "attempts", "maxAttempts"
  `
  const claimed: ClaimedRow[] = claimedRowSchema.array().parse(rawRows)

  let processed = 0
  let failed = 0
  let dead = 0

  for (const ev of claimed) {
    try {
      await handler({ id: ev.id, type: ev.type, payload: ev.payload, agencyId: ev.agencyId })
      // attempts was already incremented atomically by the claim UPDATE.
      await prisma.outboxEvent.update({
        where: { id: ev.id },
        data: { status: 'done', processedAt: new Date(), lastError: null },
      })
      processed++
    } catch (err) {
      const isDead = ev.attempts >= ev.maxAttempts
      await prisma.outboxEvent.update({
        where: { id: ev.id },
        data: {
          status: isDead ? 'dead' : 'failed',
          lastError: err instanceof Error ? err.message : String(err),
          nextAttemptAt: new Date(now.getTime() + backoffMs(ev.attempts)),
        },
      })
      if (isDead) dead++
      else failed++
    }
  }

  return { processed, failed, dead }
}
