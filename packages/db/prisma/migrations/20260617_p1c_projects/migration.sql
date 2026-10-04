-- S5.6 P-1 (3a) — Фінансові проєкти (05-ПРОЕКТИ, PROJECTS_SPEC §2). Центральна
-- сутність фінмоделі 2.0: Project (білінг-модель/цикл/валюта/ставки/юр-особа) +
-- ProjectExecutorRate (override собівартості). ADDITIVE: CompanyService/ServiceCharge
-- НЕ чіпаються (дроп+re-point — окремий коміт P-1 3b). Order одержує опційний
-- projectId + zeroBilled.
--
-- RLS: projects, project_executor_rates — нові tenant-таблиці → ENABLE/FORCE +
-- tenant_isolation (F4, wf_in_tenant). orders уже під RLS (нова колонка не змінює).

BEGIN;

-- CreateEnum
CREATE TYPE "ProjectBillingModel" AS ENUM ('fixed_monthly_advance', 'hourly_prepaid', 'hourly_postpaid');

-- CreateEnum
CREATE TYPE "ProjectBillingCycle" AS ENUM ('monthly_day_n', 'weekly_day_x', 'manual');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "zeroBilled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "billingModel" "ProjectBillingModel" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "abonAmount" DECIMAL(12,2),
    "clientHourlyRate" DECIMAL(10,2),
    "billingCycle" "ProjectBillingCycle" NOT NULL DEFAULT 'monthly_day_n',
    "cycleDay" INTEGER,
    "cycleWeekday" INTEGER,
    "nextCycleAt" TIMESTAMPTZ(3),
    "paymentTermsDays" INTEGER,
    "legalEntityId" TEXT,
    "contractRequired" BOOLEAN NOT NULL DEFAULT false,
    "contractDocumentId" TEXT,
    "requiresApproval" BOOLEAN,
    "advanceGatePct" DECIMAL(5,2),
    "includedHoursCap" DECIMAL(8,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_executor_rates" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "costHourlyRate" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "zeroCost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "project_executor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_agencyId_idx" ON "projects"("agencyId");

-- CreateIndex
CREATE INDEX "projects_agencyId_active_idx" ON "projects"("agencyId", "active");

-- CreateIndex
CREATE INDEX "projects_companyId_idx" ON "projects"("companyId");

-- CreateIndex
CREATE INDEX "projects_legalEntityId_idx" ON "projects"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_companyId_name_key" ON "projects"("companyId", "name");

-- CreateIndex
CREATE INDEX "project_executor_rates_agencyId_idx" ON "project_executor_rates"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "project_executor_rates_projectId_executorId_key" ON "project_executor_rates"("projectId", "executorId");

-- CreateIndex
CREATE INDEX "orders_projectId_idx" ON "orders"("projectId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_executor_rates" ADD CONSTRAINT "project_executor_rates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_executor_rates" ADD CONSTRAINT "project_executor_rates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_executor_rates" ADD CONSTRAINT "project_executor_rates_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RLS (F4 pattern): new tenant tables isolated on their own `agencyId`. ─────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','project_executor_rates'] LOOP
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
