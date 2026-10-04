-- DOCUMENTS-EU (06-Е + 06-Д): EU-комплект документів + публічна сторінка рахунку.
-- Нових таблиць нема — RLS на legal_entities/documents уже увімкнено (FORCE + tenant_isolation).

-- 06-Е: який комплект друкує юр-особа (ua = український, eu = EN/VAT-layout)
CREATE TYPE "DocKit" AS ENUM ('ua', 'eu');

ALTER TABLE "legal_entities"
  ADD COLUMN "docKit" "DocKit" NOT NULL DEFAULT 'ua',
  ADD COLUMN "bic" TEXT;

-- 06-Д: непередбачуваний токен публічної сторінки рахунку (null = лінка нема)
ALTER TABLE "documents" ADD COLUMN "publicToken" TEXT;

CREATE UNIQUE INDEX "documents_publicToken_key" ON "documents"("publicToken");
