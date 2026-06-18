-- S5.6 P-8 — EUR як валюта + валюта бонусів (05-Е). ADDITIVE.
-- EUR-валідація + FX (eurToUah ÷ usdToUah) — у коді (billingCurrency enum, snapshotUsd,
-- pnl/margin toUsd); ExchangeRate.eurToUah вже існує (NBU-крон). Тут лише схема:
--   + payment_settings.bonusCurrency — валюта бонус-гаманця (ledger у USD; декларативно).
-- Назва p8 датою 20260620 > p4 (20260619) — порядок застосування.

BEGIN;

-- AlterTable: PaymentSettings
ALTER TABLE "payment_settings" ADD COLUMN     "bonusCurrency" TEXT NOT NULL DEFAULT 'USD';

COMMIT;
