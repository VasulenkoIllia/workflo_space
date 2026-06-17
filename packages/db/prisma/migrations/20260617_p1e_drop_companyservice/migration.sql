-- S5.6 P-1 (3b-2) — повний дроп CompanyService (П6: абонплат у системі нуль →
-- нема даних для збереження). Recurring тепер походить із Project (генератор
-- переписано). Видаляємо: ServiceCharge.companyServiceId (+FK +unique), таблицю
-- company_services. Service-каталог і ServiceCharge лишаються.
-- Назва p1e > p1d (порядок застосування). DROP — незворотно (дані = 0).

BEGIN;

-- DropForeignKey
ALTER TABLE "company_services" DROP CONSTRAINT "company_services_companyId_fkey";

-- DropForeignKey
ALTER TABLE "company_services" DROP CONSTRAINT "company_services_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "service_charges" DROP CONSTRAINT "service_charges_companyServiceId_fkey";

-- DropIndex
DROP INDEX "service_charges_companyServiceId_month_key";

-- AlterTable
ALTER TABLE "service_charges" DROP COLUMN "companyServiceId";

-- DropTable
DROP TABLE "company_services";

COMMIT;
