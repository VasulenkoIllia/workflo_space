-- S2-09: OrderFile reconcile for the Files module.
-- Adds tenant scope (agencyId, denormalized nullable — ADR-004), soft-delete
-- (deletedAt) and content integrity (sha256). order_files is empty in every env
-- (upload code ships in this sprint), so the NOT NULL sha256 backfills nothing.
-- Idempotent: re-running is safe. commentId/documentId/context are deferred to
-- their own features (comment-attachments / S5 documents).

BEGIN;

ALTER TABLE "order_files" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "order_files" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "order_files" ADD COLUMN IF NOT EXISTS "sha256" TEXT NOT NULL;

CREATE INDEX IF NOT EXISTS "order_files_agencyId_idx" ON "order_files" ("agencyId");

DO $$ BEGIN
  ALTER TABLE "order_files"
    ADD CONSTRAINT "order_files_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "agencies" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
