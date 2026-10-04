-- DSN-4: анкета клієнта при створенні замовлення в порталі (/orders/new).
-- Адитивно: nullable-колонки + boolean з константним DEFAULT (PG11+ — без перезапису таблиці,
-- лише metadata; lock мінімальний). Rollback: DROP COLUMN ×5 + DROP TYPE ×2 (даних-залежностей нема).

-- CreateEnum
CREATE TYPE "OrderCategory" AS ENUM ('web', 'integration', 'bot', 'ai', 'data', 'crm', 'other');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('system', 'telegram', 'email', 'phone');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "category" "OrderCategory",
ADD COLUMN     "clientBudget" DECIMAL(10,2),
ADD COLUMN     "deadlineFlexible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredBilling" "BillingType",
ADD COLUMN     "preferredChannel" "ContactChannel";
