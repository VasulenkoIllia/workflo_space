-- Foundation closure (S0-S3) Phase A — AUDIT_S0_S2 / ADR-007.
-- S-D2: per-agency DocumentCounter (PK→[agencyId,type,year]) + PaymentSettings + ExchangeRate
--       (cross-tenant invoice numbering / bank details / FX are tenant-scoped, not global singletons).
-- S-D3: agencyId on InternalTask + ActivityLog (F6 — every tenant table carries agencyId).
-- S-D4: order_chat_reads FK → orders/profiles ON DELETE CASCADE (kill ghost rows).
-- R-1 : invites.agencyId (executor-invite acceptance must create AgencyMember).
-- Idempotent; nullable-add → backfill → NOT NULL where required. Platform agency = slug 'workflo'.

BEGIN;

-- ── S-D3: InternalTask.agencyId (nullable, backfill from parent order) ────────
ALTER TABLE "internal_tasks" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
UPDATE "internal_tasks" t SET "agencyId" = o."agencyId"
  FROM "orders" o WHERE t."orderId" = o."id" AND t."agencyId" IS NULL;
CREATE INDEX IF NOT EXISTS "internal_tasks_agencyId_idx" ON "internal_tasks"("agencyId");
ALTER TABLE "internal_tasks" DROP CONSTRAINT IF EXISTS "internal_tasks_agencyId_fkey";
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── S-D3: ActivityLog.agencyId (nullable, backfill from parent order) ─────────
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
UPDATE "activity_logs" a SET "agencyId" = o."agencyId"
  FROM "orders" o WHERE a."orderId" = o."id" AND a."agencyId" IS NULL;
CREATE INDEX IF NOT EXISTS "activity_logs_agencyId_idx" ON "activity_logs"("agencyId");
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_agencyId_fkey";
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── R-1: invites.agencyId (nullable; company→agency, else inviter's agency, else platform) ─
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
UPDATE "invites" i SET "agencyId" = c."agencyId"
  FROM "companies" c WHERE i."companyId" = c."id" AND i."agencyId" IS NULL;
UPDATE "invites" i SET "agencyId" = COALESCE(
    (SELECT am."agencyId" FROM "agency_members" am WHERE am."profileId" = i."invitedById" LIMIT 1),
    (SELECT "id" FROM "agencies" WHERE "slug" = 'workflo' LIMIT 1)
  ) WHERE i."agencyId" IS NULL;
CREATE INDEX IF NOT EXISTS "invites_agencyId_idx" ON "invites"("agencyId");
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_agencyId_fkey";
ALTER TABLE "invites" ADD CONSTRAINT "invites_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── S-D2: DocumentCounter — per-agency PK [agencyId,type,year] ────────────────
ALTER TABLE "document_counters" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
UPDATE "document_counters" SET "agencyId" = (SELECT "id" FROM "agencies" WHERE "slug" = 'workflo' LIMIT 1)
  WHERE "agencyId" IS NULL;
ALTER TABLE "document_counters" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "document_counters" DROP CONSTRAINT IF EXISTS "document_counters_pkey";
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_pkey" PRIMARY KEY ("agencyId","type","year");
ALTER TABLE "document_counters" DROP CONSTRAINT IF EXISTS "document_counters_agencyId_fkey";
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── S-D2: PaymentSettings.agencyId (NOT NULL unique, backfill platform) ───────
ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
UPDATE "payment_settings" SET "agencyId" = (SELECT "id" FROM "agencies" WHERE "slug" = 'workflo' LIMIT 1)
  WHERE "agencyId" IS NULL;
ALTER TABLE "payment_settings" ALTER COLUMN "agencyId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_settings_agencyId_key" ON "payment_settings"("agencyId");
ALTER TABLE "payment_settings" DROP CONSTRAINT IF EXISTS "payment_settings_agencyId_fkey";
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── S-D2: ExchangeRate.agencyId (NOT NULL unique, backfill platform) + drop id default ─
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
UPDATE "exchange_rates" SET "agencyId" = (SELECT "id" FROM "agencies" WHERE "slug" = 'workflo' LIMIT 1)
  WHERE "agencyId" IS NULL;
ALTER TABLE "exchange_rates" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "exchange_rates" ALTER COLUMN "id" DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_agencyId_key" ON "exchange_rates"("agencyId");
ALTER TABLE "exchange_rates" DROP CONSTRAINT IF EXISTS "exchange_rates_agencyId_fkey";
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── S-D4: order_chat_reads FK → orders/profiles (orphan-clean first) ──────────
DELETE FROM "order_chat_reads" WHERE "orderId" NOT IN (SELECT "id" FROM "orders");
DELETE FROM "order_chat_reads" WHERE "profileId" NOT IN (SELECT "id" FROM "profiles");
ALTER TABLE "order_chat_reads" DROP CONSTRAINT IF EXISTS "order_chat_reads_orderId_fkey";
ALTER TABLE "order_chat_reads" ADD CONSTRAINT "order_chat_reads_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_chat_reads" DROP CONSTRAINT IF EXISTS "order_chat_reads_profileId_fkey";
ALTER TABLE "order_chat_reads" ADD CONSTRAINT "order_chat_reads_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
