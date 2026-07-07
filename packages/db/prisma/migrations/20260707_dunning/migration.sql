-- 05-Б ДУНІНГ (рішення власника 07.07): нагадування про оплату по НАРАХУВАННЯХ
-- (ServiceCharge.dueDate). Ланцюжок офсетів per-agency (дефолт -3/0/+3/+7/+14,
-- [] = вимкнено), канали email + in-app, per-company opt-out (лише листи —
-- overdue-статус ставиться незалежно). DunningLog = ідемпотентність кроків.

BEGIN;

ALTER TABLE "agencies" ADD COLUMN "dunningSteps" JSONB;
ALTER TABLE "companies" ADD COLUMN "dunningOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "dunning_logs" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "stepOffset" INTEGER NOT NULL,
    "escalatedAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dunning_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dunning_logs_chargeId_stepOffset_key" ON "dunning_logs"("chargeId", "stepOffset");
CREATE INDEX "dunning_logs_agencyId_idx" ON "dunning_logs"("agencyId");
ALTER TABLE "dunning_logs" ADD CONSTRAINT "dunning_logs_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "service_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dunning_logs'] LOOP
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
