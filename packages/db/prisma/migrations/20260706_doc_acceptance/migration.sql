-- 06-ПІДПИС (рішення власника 06.07): прийняття документів клієнтом у порталі.
-- Клік + ПІБ (typed signature): фіксуємо ПІБ/час/IP/акаунт. Скоуп: договір + акт.
-- requireSignedContract — тумблер агенції «без прийнятого договору робота не стартує»
-- (рамковий: будь-який accepted-договір компанії). Вимкнено за замовчуванням.

BEGIN;

ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'accepted';

ALTER TABLE "documents" ADD COLUMN "acceptedAt" TIMESTAMPTZ(3);
ALTER TABLE "documents" ADD COLUMN "acceptedById" TEXT;
ALTER TABLE "documents" ADD COLUMN "acceptedByName" TEXT;
ALTER TABLE "documents" ADD COLUMN "acceptedIp" TEXT;

ALTER TABLE "agencies" ADD COLUMN "requireSignedContract" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
