-- S5.6 P-6 — кошторис (EstimateLine) + бюджет проєкту годинами (02-Б, 17.06). ADDITIVE.
-- Service.estimatedHours (послуга «займає N год») + estimate_lines (позиція проєкту =
-- послуга × години). Кожна позиція авто-спавнить zeroBilled-задачу (В12); Σ годин
-- звіряється з Project.includedHoursCap (м'який індикатор; overage — P-2). Per-client
-- доступність послуг СВІДОМО без allowlist (вільний вибір з каталогу — рішення власника).
-- Назва p6 датою 20260623 > p3 (20260622) — порядок застосування.

BEGIN;

-- AlterTable: Service
ALTER TABLE "services" ADD COLUMN     "estimatedHours" DECIMAL(8,2);

-- CreateTable: EstimateLine
CREATE TABLE "estimate_lines" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "amount" DECIMAL(10,2),
    "orderId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estimate_lines_orderId_key" ON "estimate_lines"("orderId");
CREATE INDEX "estimate_lines_agencyId_idx" ON "estimate_lines"("agencyId");
CREATE INDEX "estimate_lines_projectId_position_idx" ON "estimate_lines"("projectId", "position");
CREATE INDEX "estimate_lines_serviceId_idx" ON "estimate_lines"("serviceId");

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: estimate_lines — нова tenant-таблиця → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['estimate_lines'] LOOP
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
