-- Block 9 — post-remediation review fixes (audit code-review 2026-06-07).
--   • executor_rates.agencyId → NOT NULL: the table is RLS column-scoped
--     (wf_in_tenant("agencyId")), so a NULL-agency row would silently vanish under
--     enforced RLS. Backfill from the executor's agency membership, then tighten.
--   • usage_counters / agency_feature_flags: add a DB-level DEFAULT on updatedAt so
--     raw-SQL inserts don't fail (Prisma @updatedAt still overwrites on ORM writes).
--     Matches @default(now()) added to the schema → no drift.

-- executor_rates: backfill agencyId from the executor's AgencyMember (1:1 today),
-- then drop FK → SET NOT NULL → re-add FK (RESTRICT), mirroring the Block 1 pattern.
UPDATE "executor_rates" er
SET "agencyId" = am."agencyId"
FROM "agency_members" am
WHERE am."profileId" = er."executorId" AND er."agencyId" IS NULL;

ALTER TABLE "executor_rates" DROP CONSTRAINT "executor_rates_agencyId_fkey";
ALTER TABLE "executor_rates" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "executor_rates" ADD CONSTRAINT "executor_rates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Metering tables: DB-level default so a raw-SQL insert without updatedAt succeeds.
ALTER TABLE "usage_counters" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "agency_feature_flags" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
