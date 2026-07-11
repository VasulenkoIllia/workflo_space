-- S12-07 BULK-РОЗСИЛКИ: owner-лист сегменту клієнтів (all / debtors / loyalty-tier),
-- доставка через outbox → notify-матриця (system.broadcast).

CREATE TYPE "BroadcastSegment" AS ENUM ('all', 'debtors', 'tier');
CREATE TYPE "BroadcastStatus" AS ENUM ('draft', 'sending', 'sent');

CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segment" "BroadcastSegment" NOT NULL DEFAULT 'all',
    "tier" "LoyaltyTier",
    "status" "BroadcastStatus" NOT NULL DEFAULT 'draft',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "broadcasts_agencyId_status_idx" ON "broadcasts"("agencyId", "status");

ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['broadcasts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
