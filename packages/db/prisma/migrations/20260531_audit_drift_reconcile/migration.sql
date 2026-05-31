-- Audit (31.05): reconcile DB ↔ schema.prisma drift left by hand-written S1
-- migrations (index names, FK ON UPDATE, telegram unique, app-managed defaults)
-- + add the missing Invite→Company FK. Idempotent; touches no data.
--
-- NOTE: `company_members_one_owner_per_company` (a PARTIAL unique, WHERE role='owner')
-- is INTENTIONALLY kept — Prisma 5 cannot express partial uniques, so it stays a
-- raw artifact and remains the only expected `migrate diff` entry. Do NOT drop it.

BEGIN;

-- ─── 1a. Recreate composite indexes whose hand-written definition had fewer/
--          differently-ordered columns than schema (rename alone is not enough).
DROP INDEX IF EXISTS "audit_logs_actor_idx";
DROP INDEX IF EXISTS "audit_logs_actorId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_createdAt_idx" ON "audit_logs" ("actorId", "createdAt");
DROP INDEX IF EXISTS "audit_logs_action_idx";
DROP INDEX IF EXISTS "audit_logs_action_createdAt_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" ON "audit_logs" ("action", "createdAt");
DROP INDEX IF EXISTS "notification_logs_settings_created_idx";
DROP INDEX IF EXISTS "notification_logs_settingsId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "notification_logs_settingsId_createdAt_idx" ON "notification_logs" ("settingsId", "createdAt");
DROP INDEX IF EXISTS "notification_logs_rollup_idx";
DROP INDEX IF EXISTS "notification_logs_settingsId_event_createdAt_idx";
CREATE INDEX IF NOT EXISTS "notification_logs_settingsId_event_createdAt_idx" ON "notification_logs" ("settingsId", "event", "createdAt");

-- ─── 1b. Rename hand-named indexes whose definition already matches schema ──
ALTER INDEX IF EXISTS "audit_logs_resource_idx"               RENAME TO "audit_logs_resourceType_resourceId_idx";
ALTER INDEX IF EXISTS "notification_preferences_settings_idx" RENAME TO "notification_preferences_settingsId_idx";
ALTER INDEX IF EXISTS "notification_preferences_unique"       RENAME TO "notification_preferences_settingsId_category_channel_key";
ALTER INDEX IF EXISTS "blog_posts_authorid_idx"              RENAME TO "blog_posts_authorId_idx";
ALTER INDEX IF EXISTS "documents_createdbyid_idx"            RENAME TO "documents_createdById_idx";
ALTER INDEX IF EXISTS "documents_executorid_idx"             RENAME TO "documents_executorId_idx";
ALTER INDEX IF EXISTS "executor_rates_executor_effective_idx" RENAME TO "executor_rates_executorId_effectiveFrom_idx";
ALTER INDEX IF EXISTS "invites_invitedbyid_idx"             RENAME TO "invites_invitedById_idx";
ALTER INDEX IF EXISTS "order_comments_authorid_idx"         RENAME TO "order_comments_authorId_idx";
ALTER INDEX IF EXISTS "payments_confirmedby_idx"            RENAME TO "payments_confirmedBy_idx";
ALTER INDEX IF EXISTS "referrals_referredid_idx"            RENAME TO "referrals_referredId_idx";
ALTER INDEX IF EXISTS "company_members_profile_role_idx"    RENAME TO "company_members_profileId_role_idx";

-- ─── 2. notification FKs: align ON UPDATE to CASCADE (Prisma default) ───────
ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "notification_preferences_settingsId_fkey";
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_settingsId_fkey"
  FOREIGN KEY ("settingsId") REFERENCES "notification_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_logs" DROP CONSTRAINT IF EXISTS "notification_logs_settingsId_fkey";
ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_settingsId_fkey"
  FOREIGN KEY ("settingsId") REFERENCES "notification_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 3. telegramChatId: partial unique → full unique (matches schema @unique;
--        Postgres treats NULLs as distinct either way, so multi-NULL is preserved)
DROP INDEX IF EXISTS "notification_settings_telegramChatId_key";
CREATE UNIQUE INDEX "notification_settings_telegramChatId_key" ON "notification_settings" ("telegramChatId");

-- ─── 4. Drop DB defaults that Prisma manages at the app layer ───────────────
ALTER TABLE "audit_logs"               ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "notification_logs"        ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "notification_preferences" ALTER COLUMN "id" DROP DEFAULT, ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "notification_settings"    ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ─── 5. Invite → Company FK (was missing; orphan-prone) + index ────────────
CREATE INDEX IF NOT EXISTS "invites_companyId_idx" ON "invites" ("companyId");
DO $$ BEGIN
  ALTER TABLE "invites" ADD CONSTRAINT "invites_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMIT;
