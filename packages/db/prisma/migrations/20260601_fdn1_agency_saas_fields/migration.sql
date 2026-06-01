-- FDN-1 (SAAS.md): SaaS subscription fields on Agency. All nullable / defaulted
-- forward-compat — unused until SaaS enablement (Phase 1), laid now so the live
-- tenant table needs no later migration. `planId` wires the existing BillingPlan
-- catalog to the tenant. Idempotent.

BEGIN;

DO $$ BEGIN
  CREATE TYPE "AgencySubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "subdomain" TEXT;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "AgencySubscriptionStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMPTZ(3);
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "billingCustomerId" TEXT;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMPTZ(3);
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "limits" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "agencies_subdomain_key" ON "agencies" ("subdomain");
CREATE UNIQUE INDEX IF NOT EXISTS "agencies_customDomain_key" ON "agencies" ("customDomain");
CREATE INDEX IF NOT EXISTS "agencies_planId_idx" ON "agencies" ("planId");

DO $$ BEGIN
  ALTER TABLE "agencies"
    ADD CONSTRAINT "agencies_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "billing_plans" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Platform agency (workflo): Business plan, subdomain. status stays 'active'
-- (default). No-op on a fresh DB (no platform row / billing_plans unseeded).
UPDATE "agencies"
SET
  "planId" = COALESCE("planId", (SELECT "id" FROM "billing_plans" WHERE "slug" = 'business' LIMIT 1)),
  "subdomain" = COALESCE("subdomain", 'workflo')
WHERE "slug" = 'workflo';

COMMIT;
