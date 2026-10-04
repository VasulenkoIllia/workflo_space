-- S5.5 AR-20/21/22 (повний аудит 2026-06-11): tenant-scoped unique constraints +
-- Referral tenancy. Done NOW while the tables are young — these become painful
-- live-data migrations after external tenants arrive.
--
--  AR-20  executor_payouts unique (executorId, period) → (agencyId, executorId, period):
--         a multi-agency staffer needs a payout per agency; the old global key
--         collided with a row the other agency cannot even see under RLS.
--  AR-21  referrals carry their own agencyId (backfilled from the referrer company);
--         the weaker referrer-join RLS policy (f4) is replaced by the standard
--         column-scoped tenant_isolation policy.
--  AR-22  companies.slug unique per agency (two tenants may both have an "acme").
--
-- Safety: runs as owner with no GUC → wf_in_tenant is permissive (f4 design), so the
-- backfill UPDATE sees all rows without needing rls_bypass.

BEGIN;

-- ── AR-21: Referral.agencyId (nullable → backfill → NOT NULL) ────────────────
ALTER TABLE "referrals" ADD COLUMN "agencyId" TEXT;

UPDATE "referrals" r
SET "agencyId" = c."agencyId"
FROM "companies" c
WHERE c."id" = r."referrerId" AND r."agencyId" IS NULL;

ALTER TABLE "referrals" ALTER COLUMN "agencyId" SET NOT NULL;

ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "referrals_agencyId_idx" ON "referrals"("agencyId");

-- Column-scoped RLS replaces the referrer-join policy (f4 §referrals).
DROP POLICY IF EXISTS tenant_isolation ON "referrals";
CREATE POLICY tenant_isolation ON "referrals"
  USING (wf_in_tenant("agencyId"))
  WITH CHECK (wf_in_tenant("agencyId"));

-- ── AR-20: executor_payouts tenant-scoped unique ─────────────────────────────
DROP INDEX "executor_payouts_executorId_period_key";
CREATE UNIQUE INDEX "executor_payouts_agencyId_executorId_period_key"
  ON "executor_payouts"("agencyId", "executorId", "period");

-- ── AR-22: companies.slug unique per agency ──────────────────────────────────
DROP INDEX "companies_slug_key";
CREATE UNIQUE INDEX "companies_agencyId_slug_key" ON "companies"("agencyId", "slug");

COMMIT;
