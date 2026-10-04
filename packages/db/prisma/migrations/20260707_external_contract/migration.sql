-- 06-ДОГОВІР-2 (рішення власника 06.07): договір, підписаний ПОЗА системою.
-- Реєструється з власним номером + датою підписання + підписантом + файлом
-- (storedAs) або посиланням (externalUrl); одразу status=accepted. Номер
-- підтягується у пов'язані рахунки/акти («Підстава: Договір № … від …»).

BEGIN;

ALTER TABLE "documents" ADD COLUMN "signedExternally" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "contractDate" TIMESTAMPTZ(3);
ALTER TABLE "documents" ADD COLUMN "externalUrl" TEXT;

COMMIT;
