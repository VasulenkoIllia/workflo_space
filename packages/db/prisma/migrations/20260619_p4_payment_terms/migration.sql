-- S5.6 P-4 — Payment terms → charge dueDate (05-Г / В10). ADDITIVE.
-- Каскад строку оплати: Project.paymentTermsDays (вже є) → Company → агенція
-- (PaymentSettings). null на всіх ярусах → charge зберігає дефолтний per-model dueDate.
--   + companies.paymentTermsDays         (cascade tier 2, дефолт клієнта)
--   + payment_settings.paymentTermsDays  (cascade tier 3, дефолт агенції — конфіг owner-роутом)
-- Назва p4 датою 20260619 > p9_employee_referral (порядок застосування).

BEGIN;

-- AlterTable: Company
ALTER TABLE "companies" ADD COLUMN     "paymentTermsDays" INTEGER;

-- AlterTable: PaymentSettings
ALTER TABLE "payment_settings" ADD COLUMN     "paymentTermsDays" INTEGER;

COMMIT;
