-- S5.6 P-10 — разові (ручні) знижки на нарахування (05-З). ADDITIVE.
-- Ручна знижка ПОВЕРХ loyalty-знижки, надається власником на конкретне нарахування:
-- відсоток від post-loyalty net та/або фіксована сума → folded у totalAmount.
--   + service_charges.manualDiscountPct     (% поверх loyalty)
--   + service_charges.manualDiscountAmount  (резолвнута абсолютна знижка)
-- VAT-поля (05-Ж) свідомо НЕ додаємо: власник не VAT-платник; податок-на-дохід
-- per-юр-особа/канал → Finance Phase 2 (S13-06).
-- Назва p10 датою 20260621 > p8 (20260620) — порядок застосування.

BEGIN;

-- AlterTable: ServiceCharge
ALTER TABLE "service_charges" ADD COLUMN     "manualDiscountPct" DECIMAL(5,2);
ALTER TABLE "service_charges" ADD COLUMN     "manualDiscountAmount" DECIMAL(10,2);

COMMIT;
