-- 26-UTM + 26-ТАЙМЛАЙН (Leads-добудова, additive):
--   1. leads += first-touch UTM attribution columns (set on website intake, read-only in app)
--   2. lead_activities — append-only journal of lead lifecycle events (RLS wf_in_tenant)
--   3. contact_forms += UTM/page/referrer of the visit + leadId link to the auto-created lead
--      (platform-level table, no RLS — unchanged)

BEGIN;

ALTER TABLE "leads"
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT;

CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt");
CREATE INDEX "lead_activities_agencyId_idx" ON "lead_activities"("agencyId");

ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: lead_activities is a new tenant table → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_activities'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

ALTER TABLE "contact_forms"
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT,
  ADD COLUMN "page" TEXT,
  ADD COLUMN "referrer" TEXT,
  ADD COLUMN "leadId" TEXT;

COMMIT;
