import { createHash } from 'node:crypto'
import type { Prisma } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'

/**
 * Header-based request idempotency for money-mutating endpoints (S5-02). The
 * durable {@link RaceGuard}: a retry or double-submit carrying the same
 * `Idempotency-Key` runs the operation EXACTLY once and replays the first stored
 * response. Backed by the `idempotency_keys` table (24h TTL), not in-memory — so
 * it survives restarts and serializes across replicas.
 *
 * Serialization mechanism (READ COMMITTED): the claiming `INSERT … ON CONFLICT DO
 * NOTHING` takes the unique-key insert lock. A concurrent same-key INSERT BLOCKS
 * until the first transaction commits (then sees the conflict → 0 rows → reads the
 * committed response → replays) or rolls back (then inserts → runs the op itself).
 * This is what makes a double-clicked payment produce ONE row, never two.
 */

const TTL_MS = 24 * 60 * 60 * 1000

/** Stable SHA-256 over the request payload — guards against key reuse with a different body. */
export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export interface IdempotentResponse {
  status: number
  body: unknown
}

export interface IdempotencyOutcome extends IdempotentResponse {
  /** true when the stored response was replayed (the operation did NOT re-run). */
  replayed: boolean
}

interface ExistingRow {
  requestHash: string
  responseStatus: number | null
  responseBody: unknown
}

export interface IdempotencyArgs {
  key: string
  endpoint: string
  agencyId: string
  requestHash: string
  now?: Date
}

/**
 * Run `fn` under the idempotency guard, INSIDE the caller's tenant transaction
 * (so the claim, the operation's writes, and the stored response all commit
 * atomically). `fn` must be the money-mutating work; it runs at most once per
 * `(key, endpoint)`.
 *
 *  - first caller  → claims the key, runs `fn`, persists `{status, body}`, returns it
 *  - same key+hash → replays the stored response (operation does NOT re-run)
 *  - same key, DIFFERENT hash → 422 (the key was reused for a different request)
 */
export async function withIdempotency(
  tx: Prisma.TransactionClient,
  args: IdempotencyArgs,
  fn: () => Promise<IdempotentResponse>
): Promise<IdempotencyOutcome> {
  const now = args.now ?? new Date()
  const expiresAt = new Date(now.getTime() + TTL_MS)
  // The table PK is (key, endpoint) — GLOBAL across tenants. Namespace the stored key
  // by agency so two tenants can independently use the same client-supplied key value
  // without a spurious cross-tenant conflict (RLS would also hide the other's row).
  const scopedKey = `${args.agencyId}:${args.key}`

  // Claim. $executeRaw returns affected-row count: 1 = we own it, 0 = it already exists.
  const claimed = await tx.$executeRaw`
    INSERT INTO "idempotency_keys" ("key", "endpoint", "agencyId", "requestHash", "createdAt", "expiresAt")
    VALUES (${scopedKey}, ${args.endpoint}, ${args.agencyId}, ${args.requestHash}, ${now}, ${expiresAt})
    ON CONFLICT ("key", "endpoint") DO NOTHING
  `

  if (claimed === 0) {
    const rows = await tx.$queryRaw<ExistingRow[]>`
      SELECT "requestHash", "responseStatus", "responseBody"
      FROM "idempotency_keys"
      WHERE "key" = ${scopedKey} AND "endpoint" = ${args.endpoint}
    `
    const existing = rows[0]
    // Defensive: the conflicting row must exist (the INSERT just lost the race to it).
    if (!existing) {
      throw new AppError(ApiErrorCode.CONFLICT, 'Idempotency conflict, retry', 409)
    }
    if (existing.requestHash !== args.requestHash) {
      throw new AppError(
        ApiErrorCode.VALIDATION_ERROR,
        'Idempotency-Key already used for a different request',
        422
      )
    }
    if (existing.responseStatus === null) {
      // The owning transaction claimed the key but has not yet persisted its response.
      // Under READ COMMITTED the claim INSERT above would have blocked on it, so this
      // is rare (e.g. the owner is mid-flight in the SAME connection) — tell the client to retry.
      throw new AppError(ApiErrorCode.CONFLICT, 'Request already in progress, retry', 409)
    }
    return { status: existing.responseStatus, body: existing.responseBody, replayed: true }
  }

  const result = await fn()

  await tx.idempotencyKey.update({
    where: { key_endpoint: { key: scopedKey, endpoint: args.endpoint } },
    data: {
      responseStatus: result.status,
      responseBody: (result.body ?? null) as Prisma.InputJsonValue,
    },
  })

  return { ...result, replayed: false }
}
