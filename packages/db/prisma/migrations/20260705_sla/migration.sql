-- S10-02 SLA (спека 02-orders §C): per-agency політики реакції per-пріоритет +
-- SLA-штампи на замовленні (дедлайни першої відповіді/розв'язання, факт першої
-- відповіді команди, момент порушення від cron).

BEGIN;

ALTER TABLE "orders"
  ADD COLUMN "firstResponseDueAt" TIMESTAMPTZ(3),
  ADD COLUMN "resolutionDueAt" TIMESTAMPTZ(3),
  ADD COLUMN "firstRespondedAt" TIMESTAMPTZ(3),
  ADD COLUMN "slaBreachedAt" TIMESTAMPTZ(3);

CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "priority" "OrderPriority" NOT NULL,
    "firstResponseMins" INTEGER NOT NULL,
    "resolutionMins" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sla_policies_agencyId_priority_key" ON "sla_policies"("agencyId", "priority");
CREATE INDEX "sla_policies_agencyId_idx" ON "sla_policies"("agencyId");
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sla_policies'] LOOP
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
