-- S5.6 P-9b — реферал-працівника (12-РЕФЕРАЛ-ПРАЦІВНИКА, PROJECTS_SPEC §4.2). ADDITIVE.
-- Працівник привів клієнта → отримує % від ЧИСТОГО доходу агенції з цього клієнта
-- (П4: один % по клієнту цілком). Нараховується окремим рядком на виплату.
--   + companies.referredByEmployeeId   — Profile, що привів клієнта (plain-String FK)
--   + referral_settings.employeeReferralPercent — єдиний % (per-agency налаштування)
--   + executor_payouts.referralBonusAmount — окремий рядок виплати
-- Назва p9 > p5/p2d (порядок застосування).

BEGIN;

-- AlterTable: Company
ALTER TABLE "companies" ADD COLUMN     "referredByEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "companies_referredByEmployeeId_idx" ON "companies"("referredByEmployeeId");

-- AlterTable: ReferralSettings
ALTER TABLE "referral_settings" ADD COLUMN     "employeeReferralPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable: ExecutorPayout
ALTER TABLE "executor_payouts" ADD COLUMN     "referralBonusAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMIT;
