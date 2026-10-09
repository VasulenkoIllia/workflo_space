-- 06-Д (09.10.2026, PERMISSIONS §3): публічний лінк на рахунок отримує строк дії.
-- Адитивно: nullable-колонка, без локів на запис (ADD COLUMN без DEFAULT — миттєво).
-- Наявні лінки — ще 30 днів від міграції, щоб уже надіслані клієнтам не обірвались;
-- код трактує NULL як прострочений і перевидає токен при наступному «Поділитись».
-- Rollback: ALTER TABLE "documents" DROP COLUMN "publicTokenExpiresAt";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "publicTokenExpiresAt" TIMESTAMPTZ(3);

-- Backfill
UPDATE "documents" SET "publicTokenExpiresAt" = now() + interval '30 days' WHERE "publicToken" IS NOT NULL;
