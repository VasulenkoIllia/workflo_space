-- Module 26 (Leads/CRM): tenant-scoped lead pipeline. Fixed-stage MVP (LeadStatus enum).
-- Plain-String FKs for assignee/company/convertedOrder (project convention, no constraint);
-- agencyId has a real FK + RLS (F4 wf_in_tenant), like every other tenant table.

BEGIN;

CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');

CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "estimatedValue" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "assigneeId" TEXT,
    "companyId" TEXT,
    "convertedOrderId" TEXT,
    "lostReason" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_agencyId_idx" ON "leads"("agencyId");
CREATE INDEX "leads_agencyId_status_idx" ON "leads"("agencyId", "status");

ALTER TABLE "leads" ADD CONSTRAINT "leads_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: leads is a new tenant table → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

COMMIT;
