-- S5.6 P-1б — Юр-особи агенції (20-Д, LEGAL_ENTITY_SPEC). Передумова S6-документів і
-- P-1 (Project.legalEntityId). N юр-осіб на агенцію, дефолтна створюється в
-- provisionAgency(). `documents.legalEntityId` — від кого виставлено (резолв у S6).
-- Project FK додається окремо в P-1 (модель Project ще не існує).
--
-- RLS: legal_entities — нова tenant-таблиця → ENABLE/FORCE + tenant_isolation
-- policy (F4 pattern, wf_in_tenant; permissive поки GUC не виставлено). documents
-- вже під RLS (f4) — нова колонка цього не змінює.

BEGIN;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "legalEntityId" TEXT;

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalType" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxId" TEXT,
    "vatPayer" BOOLEAN NOT NULL DEFAULT false,
    "vatId" TEXT,
    "legalAddress" TEXT,
    "bankName" TEXT,
    "iban" TEXT,
    "signerName" TEXT,
    "signerTitle" TEXT,
    "stampUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_entities_agencyId_idx" ON "legal_entities"("agencyId");

-- CreateIndex
CREATE INDEX "legal_entities_agencyId_isDefault_idx" ON "legal_entities"("agencyId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_agencyId_name_key" ON "legal_entities"("agencyId", "name");

-- CreateIndex
CREATE INDEX "documents_legalEntityId_idx" ON "documents"("legalEntityId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RLS (F4 pattern): legal_entities isolated on its own `agencyId`. ──────────
ALTER TABLE "legal_entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_entities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "legal_entities";
CREATE POLICY tenant_isolation ON "legal_entities"
  USING (wf_in_tenant("agencyId"))
  WITH CHECK (wf_in_tenant("agencyId"));

COMMIT;
