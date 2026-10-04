-- s5_00_financial_core (Sprint 5) — net-new financial models + column deltas.
-- See docs/S5_PLAN.md. Money = Decimal; every new tenant table carries `agencyId`
-- and gets the F4 `tenant_isolation` RLS policy at the bottom.

-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "WalletTxnSource" AS ENUM ('referral_bonus', 'manual_adjustment', 'invoice_payment', 'refund');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('draft', 'approved', 'paid');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('recurring', 'one_time');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('infrastructure', 'software', 'salary', 'contractor', 'rent', 'tax', 'marketing', 'other');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('manual', 'executor_rate');

-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('monthly', 'quarterly', 'annual', 'one_time');

-- CreateEnum
CREATE TYPE "ChargeFrequency" AS ENUM ('monthly', 'quarterly', 'annual');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChargeStatus" ADD VALUE 'partial';
ALTER TYPE "ChargeStatus" ADD VALUE 'written_off';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "moneyBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tierOverride" "LoyaltyTier";

-- AlterTable
ALTER TABLE "company_services" ADD COLUMN     "frequency" "ChargeFrequency" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "nextChargeAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "amountUsd" DECIMAL(10,2),
ADD COLUMN     "rateUsed" DECIMAL(10,4),
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "service_charges" ADD COLUMN     "baseAmount" DECIMAL(10,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountPct" DECIMAL(5,2),
ADD COLUMN     "totalAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "defaultPriceUsd" DECIMAL(10,2),
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "source" "WalletTxnSource" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sourceId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_settings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tiers" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "referral_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tier_history" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromTier" "LoyaltyTier",
    "toTier" "LoyaltyTier" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_tier_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executor_payouts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "baseSalary" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billableHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "hourlyEarned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "executor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "source" "ExpenseSource" NOT NULL DEFAULT 'manual',
    "vendor" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "frequency" "ExpenseFrequency",
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "executorId" TEXT,
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key","endpoint")
);

-- CreateIndex
CREATE INDEX "wallet_transactions_companyId_createdAt_idx" ON "wallet_transactions"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_agencyId_idx" ON "wallet_transactions"("agencyId");

-- CreateIndex
CREATE INDEX "payment_allocations_chargeId_idx" ON "payment_allocations"("chargeId");

-- CreateIndex
CREATE INDEX "payment_allocations_agencyId_idx" ON "payment_allocations"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_chargeId_key" ON "payment_allocations"("paymentId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_settings_agencyId_key" ON "referral_settings"("agencyId");

-- CreateIndex
CREATE INDEX "loyalty_tier_history_companyId_createdAt_idx" ON "loyalty_tier_history"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_tier_history_agencyId_idx" ON "loyalty_tier_history"("agencyId");

-- CreateIndex
CREATE INDEX "executor_payouts_agencyId_idx" ON "executor_payouts"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "executor_payouts_executorId_period_key" ON "executor_payouts"("executorId", "period");

-- CreateIndex
CREATE INDEX "expenses_agencyId_category_idx" ON "expenses"("agencyId", "category");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_agencyId_idx" ON "idempotency_keys"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_agencyId_sourceType_sourceId_key" ON "payments"("agencyId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "service_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_settings" ADD CONSTRAINT "referral_settings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_history" ADD CONSTRAINT "loyalty_tier_history_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_history" ADD CONSTRAINT "loyalty_tier_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executor_payouts" ADD CONSTRAINT "executor_payouts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── RLS (F4 pattern): new tenant tables isolated on their own `agencyId`. The
--    wf_in_tenant() predicate is created by 20260603_f4_rls_policies (runs first):
--    permissive when the GUC is unset, so this is inert until RLS_ENFORCED flips.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wallet_transactions','payment_allocations','referral_settings',
    'loyalty_tier_history','executor_payouts','expenses','idempotency_keys'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
