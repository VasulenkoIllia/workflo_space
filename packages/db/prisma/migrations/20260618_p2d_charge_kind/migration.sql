-- S5.6 P-2d — ServiceCharge.kind (subscription|hourly|overage) для гібрида: один
-- цикл може дати ДВА нарахування з однаковим periodStart (абон-аванс + overage
-- понад ліміт), тож унікальність розширюється на kind. ADDITIVE (default).
-- Назва p2d > p1e/p5 (порядок застосування).

BEGIN;

-- DropIndex
DROP INDEX "service_charges_projectId_periodStart_key";

-- AlterTable
ALTER TABLE "service_charges" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'subscription';

-- CreateIndex
CREATE UNIQUE INDEX "service_charges_projectId_periodStart_kind_key" ON "service_charges"("projectId", "periodStart", "kind");

COMMIT;
