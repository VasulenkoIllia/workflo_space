-- S13-06 (частина «податок-на-дохід»): ставка % від отриманого доходу per-юр-особа/канал
-- (ФОП 5% / крипта-картка 0%) + привʼязка платежу до юр-особи-отримувача.
-- Нових таблиць нема — RLS на legal_entities/payments уже FORCE.

ALTER TABLE "legal_entities"
  ADD COLUMN "incomeTaxPct" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "payments"
  ADD COLUMN "legalEntityId" TEXT;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payments_legalEntityId_idx" ON "payments"("legalEntityId");
