-- S5.6 P-7 / 02-А — погодження оцінки клієнтом (опційне). ADDITIVE: новий enum
-- OrderApprovalStatus + 5 nullable/defaulted колонок на orders + FK на profiles
-- (decided-by audit). requiresApproval — snapshot ефективного прапорця (дефолт false →
-- поточна поведінка без погодження зберігається). orders уже під RLS — нової таблиці
-- нема, тож політики не чіпаємо.

-- CreateEnum
CREATE TYPE "OrderApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvalStatus" "OrderApprovalStatus",
ADD COLUMN     "approvalDecidedAt" TIMESTAMPTZ(3),
ADD COLUMN     "approvalDecidedById" TEXT,
ADD COLUMN     "approvalComment" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_approvalDecidedById_fkey" FOREIGN KEY ("approvalDecidedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
