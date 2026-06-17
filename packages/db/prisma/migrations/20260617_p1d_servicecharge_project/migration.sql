-- S5.6 P-1 (3b-1) — re-point ServiceCharge на Project (PROJECTS_SPEC §2.2, П6).
-- ADDITIVE: companyServiceId → nullable (буде видалений у 3b-2 з дропом
-- CompanyService); + projectId + periodStart/End + unique (projectId, periodStart).
-- Генератор recurringCharges НЕ змінюється тут (перепис на Project — 3b-2).
-- service_charges уже під RLS (f4) — без змін. Назва p1d > p1c_projects (FK на projects).

BEGIN;

-- DropForeignKey
ALTER TABLE "service_charges" DROP CONSTRAINT "service_charges_companyServiceId_fkey";

-- AlterTable
ALTER TABLE "service_charges" ADD COLUMN     "periodEnd" DATE,
ADD COLUMN     "periodStart" DATE,
ADD COLUMN     "projectId" TEXT,
ALTER COLUMN "companyServiceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "service_charges_projectId_idx" ON "service_charges"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "service_charges_projectId_periodStart_key" ON "service_charges"("projectId", "periodStart");

-- AddForeignKey
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "company_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
