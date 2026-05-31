-- S1.6 Schema-delta batch-1: additive reconcile columns/tables so the S2 core
-- (orders / chat) builds without further migrations. Additive + idempotent.

BEGIN;

-- Order: on-hold / cancelled reasons (state-machine, module 02).
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "onHoldReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;

-- OrderComment: edit / soft-delete window (module 03).
ALTER TABLE "order_comments"
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);

-- Per-(order, profile) read marker for unread counts (modules 03/18).
CREATE TABLE IF NOT EXISTS "order_chat_reads" (
    "orderId"    TEXT NOT NULL,
    "profileId"  TEXT NOT NULL,
    "lastReadAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "order_chat_reads_pkey" PRIMARY KEY ("orderId", "profileId")
);
CREATE INDEX IF NOT EXISTS "order_chat_reads_profileId_idx" ON "order_chat_reads"("profileId");

COMMIT;
