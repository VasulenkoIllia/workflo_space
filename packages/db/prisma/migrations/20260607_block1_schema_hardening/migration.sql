-- Block 1 — Schema hardening (audit 2026-06).
--   1. ExecutorRate: drop @unique(executorId) which killed the effectiveFrom/Until
--      historical-rate window (modules 19/22 P&L) → composite @@unique([executorId,effectiveFrom]).
--   2. Idempotency: payments(provider,providerPaymentId) + referral_bonuses(sourceType,sourceId)
--      (NULLs are distinct in Postgres, so manual rows with NULL providerPaymentId stay unconstrained).
--   3. agencyId NOT NULL: backfill→tighten on order/company children + financial tables so no row
--      silently falls outside its tenant once RLS is enforced. audit_logs / outbox_events / invites /
--      services stay nullable by design (pre-auth, global, agency-level rows).
--   4. SaaS metering substrate: usage_counters + agency_feature_flags (+ RLS, F4 pattern).

-- ── 1. ExecutorRate historical-rate fix ──────────────────────────────────────
DROP INDEX "executor_rates_executorId_effectiveFrom_idx";
DROP INDEX "executor_rates_executorId_key";
CREATE UNIQUE INDEX "executor_rates_executorId_effectiveFrom_key" ON "executor_rates"("executorId", "effectiveFrom");

-- ── 2. Idempotency unique constraints ────────────────────────────────────────
CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "payments"("provider", "providerPaymentId");
CREATE UNIQUE INDEX "referral_bonuses_sourceType_sourceId_key" ON "referral_bonuses"("sourceType", "sourceId");

-- ── 3. agencyId backfill (BEFORE tightening) ─────────────────────────────────
-- order children → orders.agencyId
UPDATE "order_comments"  c SET "agencyId" = o."agencyId" FROM "orders"     o  WHERE c."orderId"   = o."id" AND c."agencyId" IS NULL;
UPDATE "order_files"     f SET "agencyId" = o."agencyId" FROM "orders"     o  WHERE f."orderId"   = o."id" AND f."agencyId" IS NULL;
UPDATE "internal_tasks"  t SET "agencyId" = o."agencyId" FROM "orders"     o  WHERE t."orderId"   = o."id" AND t."agencyId" IS NULL;
UPDATE "time_logs"       l SET "agencyId" = o."agencyId" FROM "orders"     o  WHERE l."orderId"   = o."id" AND l."agencyId" IS NULL;
UPDATE "activity_logs"   a SET "agencyId" = o."agencyId" FROM "orders"     o  WHERE a."orderId"   = o."id" AND a."agencyId" IS NULL;
-- company children → companies.agencyId
UPDATE "service_charges" s SET "agencyId" = co."agencyId" FROM "companies" co WHERE s."companyId" = co."id" AND s."agencyId" IS NULL;
UPDATE "payments"        p SET "agencyId" = co."agencyId" FROM "companies" co WHERE p."companyId" = co."id" AND p."agencyId" IS NULL;
UPDATE "documents"       d SET "agencyId" = co."agencyId" FROM "companies" co WHERE d."companyId" = co."id" AND d."agencyId" IS NULL;

-- ── 3b. Drop old FKs (were ON DELETE SET NULL), tighten NOT NULL, re-add RESTRICT ──
ALTER TABLE "activity_logs"  DROP CONSTRAINT "activity_logs_agencyId_fkey";
ALTER TABLE "documents"      DROP CONSTRAINT "documents_agencyId_fkey";
ALTER TABLE "internal_tasks" DROP CONSTRAINT "internal_tasks_agencyId_fkey";
ALTER TABLE "order_comments" DROP CONSTRAINT "order_comments_agencyId_fkey";
ALTER TABLE "order_files"    DROP CONSTRAINT "order_files_agencyId_fkey";
ALTER TABLE "payments"       DROP CONSTRAINT "payments_agencyId_fkey";
ALTER TABLE "service_charges" DROP CONSTRAINT "service_charges_agencyId_fkey";
ALTER TABLE "time_logs"      DROP CONSTRAINT "time_logs_agencyId_fkey";

ALTER TABLE "activity_logs"  ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "documents"      ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "internal_tasks" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "order_comments" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "order_files"    ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "payments"       ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "service_charges" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "time_logs"      ALTER COLUMN "agencyId" SET NOT NULL;

ALTER TABLE "order_comments"  ADD CONSTRAINT "order_comments_agencyId_fkey"  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_files"     ADD CONSTRAINT "order_files_agencyId_fkey"     FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_tasks"  ADD CONSTRAINT "internal_tasks_agencyId_fkey"  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "time_logs"       ADD CONSTRAINT "time_logs_agencyId_fkey"       FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments"        ADD CONSTRAINT "payments_agencyId_fkey"        FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_logs"   ADD CONSTRAINT "activity_logs_agencyId_fkey"   FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents"       ADD CONSTRAINT "documents_agencyId_fkey"       FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. SaaS metering substrate ───────────────────────────────────────────────
CREATE TABLE "usage_counters" (
    "agencyId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("agencyId","resource","period")
);

CREATE TABLE "agency_feature_flags" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "agency_feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_counters_agencyId_idx" ON "usage_counters"("agencyId");
CREATE INDEX "agency_feature_flags_agencyId_idx" ON "agency_feature_flags"("agencyId");
CREATE UNIQUE INDEX "agency_feature_flags_agencyId_flag_key" ON "agency_feature_flags"("agencyId", "flag");

ALTER TABLE "usage_counters"      ADD CONSTRAINT "usage_counters_agencyId_fkey"      FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_feature_flags" ADD CONSTRAINT "agency_feature_flags_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4b. RLS for the 2 new tenant tables (F4 pattern: column-scoped, FORCE) ────
-- wf_in_tenant() already exists (20260603_f4_rls_policies); workflo_app inherits
-- table grants via ALTER DEFAULT PRIVILEGES set in that migration.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usage_counters','agency_feature_flags'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
