-- S1.6 Tenancy foundation (ADR-004): Agency tenant root + agencyId scoping.
--
-- Phase 0 = single platform tenant. Adds Agency + AgencyMember, denormalized
-- agencyId on agency-scoped + hot tables, backfills the one platform agency,
-- and enrolls existing team profiles (owner/executor) as agency members.
-- Additive + idempotent (safe to re-run; safe on empty or populated DB).
-- FK actions mirror Prisma defaults (required -> RESTRICT, optional -> SET NULL).

-- ─── Enum (outside transaction) ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AgencyMemberRole" AS ENUM ('owner', 'executor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

BEGIN;

-- ─── Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "agencies" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "ownerId"   TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agencies_slug_key" ON "agencies"("slug");

CREATE TABLE IF NOT EXISTS "agency_members" (
    "id"        TEXT NOT NULL,
    "agencyId"  TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role"      "AgencyMemberRole" NOT NULL DEFAULT 'executor',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agency_members_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agency_members_agencyId_idx" ON "agency_members"("agencyId");
CREATE INDEX IF NOT EXISTS "agency_members_profileId_idx" ON "agency_members"("profileId");
CREATE UNIQUE INDEX IF NOT EXISTS "agency_members_agencyId_profileId_key" ON "agency_members"("agencyId", "profileId");

-- ─── Platform agency (Phase 0: single tenant) ──────────────────────────────
INSERT INTO "agencies" ("id", "name", "slug", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Workflo', 'workflo', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- ─── agencyId columns (nullable first for safe backfill) ────────────────────
ALTER TABLE "companies"       ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "orders"          ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "payments"        ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "documents"       ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "service_charges" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "order_comments"  ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "time_logs"       ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "services"        ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "executor_rates"  ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "audit_logs"      ADD COLUMN IF NOT EXISTS "agencyId" TEXT;

-- ─── Backfill → platform agency (direct + derived from owning company/order) ─
UPDATE "companies"      SET "agencyId" = '00000000-0000-4000-8000-000000000001' WHERE "agencyId" IS NULL;
UPDATE "services"       SET "agencyId" = '00000000-0000-4000-8000-000000000001' WHERE "agencyId" IS NULL;
UPDATE "executor_rates" SET "agencyId" = '00000000-0000-4000-8000-000000000001' WHERE "agencyId" IS NULL;
UPDATE "audit_logs"     SET "agencyId" = '00000000-0000-4000-8000-000000000001' WHERE "agencyId" IS NULL;

UPDATE "orders" o SET "agencyId" = COALESCE(c."agencyId", '00000000-0000-4000-8000-000000000001')
  FROM "companies" c WHERE o."companyId" = c."id" AND o."agencyId" IS NULL;
UPDATE "orders" SET "agencyId" = '00000000-0000-4000-8000-000000000001' WHERE "agencyId" IS NULL;

UPDATE "payments" p SET "agencyId" = c."agencyId"
  FROM "companies" c WHERE p."companyId" = c."id" AND p."agencyId" IS NULL;
UPDATE "documents" d SET "agencyId" = c."agencyId"
  FROM "companies" c WHERE d."companyId" = c."id" AND d."agencyId" IS NULL;
UPDATE "service_charges" s SET "agencyId" = c."agencyId"
  FROM "companies" c WHERE s."companyId" = c."id" AND s."agencyId" IS NULL;
UPDATE "order_comments" oc SET "agencyId" = o."agencyId"
  FROM "orders" o WHERE oc."orderId" = o."id" AND oc."agencyId" IS NULL;
UPDATE "time_logs" tl SET "agencyId" = o."agencyId"
  FROM "orders" o WHERE tl."orderId" = o."id" AND tl."agencyId" IS NULL;

-- ─── companies.agencyId → NOT NULL (the tenant anchor) ─────────────────────
ALTER TABLE "companies" ALTER COLUMN "agencyId" SET NOT NULL;

-- ─── Indexes (Prisma naming) ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "companies_agencyId_idx"       ON "companies"("agencyId");
CREATE INDEX IF NOT EXISTS "orders_agencyId_idx"          ON "orders"("agencyId");
CREATE INDEX IF NOT EXISTS "payments_agencyId_idx"        ON "payments"("agencyId");
CREATE INDEX IF NOT EXISTS "documents_agencyId_idx"       ON "documents"("agencyId");
CREATE INDEX IF NOT EXISTS "service_charges_agencyId_idx" ON "service_charges"("agencyId");
CREATE INDEX IF NOT EXISTS "order_comments_agencyId_idx"  ON "order_comments"("agencyId");
CREATE INDEX IF NOT EXISTS "time_logs_agencyId_idx"       ON "time_logs"("agencyId");
CREATE INDEX IF NOT EXISTS "services_agencyId_idx"        ON "services"("agencyId");
CREATE INDEX IF NOT EXISTS "executor_rates_agencyId_idx"  ON "executor_rates"("agencyId");
CREATE INDEX IF NOT EXISTS "audit_logs_agencyId_idx"      ON "audit_logs"("agencyId");

-- ─── Foreign keys (guarded; Prisma default referential actions) ────────────
DO $$ BEGIN ALTER TABLE "companies" ADD CONSTRAINT "companies_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "services" ADD CONSTRAINT "services_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "executor_rates" ADD CONSTRAINT "executor_rates_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "agencies" ADD CONSTRAINT "agencies_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Enroll existing team (owner/executor) as agency members ───────────────
INSERT INTO "agency_members" ("id", "agencyId", "profileId", "role")
SELECT gen_random_uuid(),
       '00000000-0000-4000-8000-000000000001',
       p."id",
       (CASE WHEN p."role" = 'owner' THEN 'owner' ELSE 'executor' END)::"AgencyMemberRole"
FROM "profiles" p
WHERE p."role" IN ('owner', 'executor')
ON CONFLICT ("agencyId", "profileId") DO NOTHING;

-- ─── Platform agency owner = earliest owner profile ────────────────────────
UPDATE "agencies"
SET "ownerId" = (SELECT "id" FROM "profiles" WHERE "role" = 'owner' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "id" = '00000000-0000-4000-8000-000000000001' AND "ownerId" IS NULL;

COMMIT;
