-- S1.6 Outbox (ADR topic #2-3): transactional outbox for reliable notify /
-- webhook / search-index delivery with retry + DLQ. Additive + idempotent.

-- ─── Enum (outside transaction) ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'processing', 'done', 'failed', 'dead');
EXCEPTION WHEN duplicate_object THEN null; END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS "outbox_events" (
    "id"            TEXT NOT NULL,
    "agencyId"      TEXT,
    "type"          TEXT NOT NULL,
    "payload"       JSONB NOT NULL,
    "status"        "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts"      INTEGER NOT NULL DEFAULT 0,
    "maxAttempts"   INTEGER NOT NULL DEFAULT 8,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError"     TEXT,
    "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"   TIMESTAMPTZ(3),
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outbox_events_status_nextAttemptAt_idx" ON "outbox_events"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "outbox_events_agencyId_idx" ON "outbox_events"("agencyId");

COMMIT;
