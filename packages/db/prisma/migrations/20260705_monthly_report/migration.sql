-- S11 scheduled email-звіти: owner-тумблер «місячний звіт на email».
-- monthlyReportEnabled = політика увімкнена; monthlyReportLastSentAt = за який момент
-- останній раз відправляли (cron шле раз на місяць за ПОПЕРЕДНІЙ місяць).

BEGIN;

ALTER TABLE "agencies" ADD COLUMN "monthlyReportEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agencies" ADD COLUMN "monthlyReportLastSentAt" TIMESTAMPTZ(3);

COMMIT;
