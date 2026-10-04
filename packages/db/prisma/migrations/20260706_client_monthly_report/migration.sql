-- 19-Г місячний звіт клієнту: новий тип документа + owner-тумблер розсилки.
-- Cron раз на добу: агенціям з увімкненим clientMonthlyReportEnabled — для кожної
-- компанії з активністю за попередній місяць генерується Document(monthly_report)
-- + лист із PDF на Company.documentEmail (fallback — власники компанії).

BEGIN;

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'monthly_report';

ALTER TABLE "agencies" ADD COLUMN "clientMonthlyReportEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agencies" ADD COLUMN "clientMonthlyReportLastSentAt" TIMESTAMPTZ(3);

COMMIT;
