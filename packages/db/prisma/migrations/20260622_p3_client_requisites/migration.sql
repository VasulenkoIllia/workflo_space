-- S5.6 P-3 — юр-реквізити клієнта + email для документів (06-Б). ADDITIVE.
-- Клієнт сам заповнює в Portal свої юр-дані (document "to" party); агенція читає їх
-- при генерації документів (S6). legalIsComplete (Юр-2 аналог) гейтить генерацію
-- документів, не роботу. Один набір на клієнта (multi-entity-per-client — поза скоупом).
-- Агенційний бік (LegalEntity, 20-Д) уже готовий у P-1б. Контракт-гейт (блок генерації)
-- = P-7, не тут.
-- Назва p3 датою 20260622 > p10 (20260621) — порядок застосування.

BEGIN;

-- AlterTable: Company (client legal requisites)
ALTER TABLE "companies" ADD COLUMN     "legalType" TEXT;
ALTER TABLE "companies" ADD COLUMN     "legalName" TEXT;
ALTER TABLE "companies" ADD COLUMN     "taxId" TEXT;
ALTER TABLE "companies" ADD COLUMN     "vatPayer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN     "vatId" TEXT;
ALTER TABLE "companies" ADD COLUMN     "legalAddress" TEXT;
ALTER TABLE "companies" ADD COLUMN     "bankName" TEXT;
ALTER TABLE "companies" ADD COLUMN     "iban" TEXT;
ALTER TABLE "companies" ADD COLUMN     "signerName" TEXT;
ALTER TABLE "companies" ADD COLUMN     "signerTitle" TEXT;
ALTER TABLE "companies" ADD COLUMN     "documentEmail" TEXT;
ALTER TABLE "companies" ADD COLUMN     "documentEmailCc" TEXT;
ALTER TABLE "companies" ADD COLUMN     "legalIsComplete" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
