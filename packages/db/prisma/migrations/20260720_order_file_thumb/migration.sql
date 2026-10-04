-- S10-06ч МІНІАТЮРИ: ключ webp-прев'ю для зображень-вкладень замовлень.
-- best-effort (nullable) — генерація на upload не блокує завантаження файлу.
-- Нових таблиць нема — RLS на order_files уже FORCE.

ALTER TABLE "order_files"
  ADD COLUMN "thumbKey" TEXT;
