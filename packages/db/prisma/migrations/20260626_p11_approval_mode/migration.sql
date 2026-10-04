-- S5.6 P-11 / PROJECTS_SPEC §8 — 3-режимне погодження вартості + counter-offer.
-- ADDITIVE, zero-risk: нові enums + nullable/defaulted колонки. Каскад дефолтів
-- approvalMode/invoiceApprover (Agency floor non-null → Company/Project override nullable →
-- Order snapshot). ServiceCharge отримує дзеркало 02-А approval-полів (on_actuals Гейт-2) +
-- approvedAmount (counter-offer). orders/service_charges уже під RLS — нової таблиці нема.

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('none', 'upfront', 'on_actuals');

-- CreateEnum
CREATE TYPE "InvoiceApprover" AS ENUM ('client', 'internal');

-- AlterTable (agency-tier floor; non-null so the cascade terminates)
ALTER TABLE "agencies" ADD COLUMN     "defaultApprovalMode" "ApprovalMode" NOT NULL DEFAULT 'none',
ADD COLUMN     "defaultInvoiceApprover" "InvoiceApprover" NOT NULL DEFAULT 'client';

-- AlterTable (per-client override; null → inherit agency)
ALTER TABLE "companies" ADD COLUMN     "approvalMode" "ApprovalMode",
ADD COLUMN     "invoiceApprover" "InvoiceApprover";

-- AlterTable (per-project override; null → inherit company)
ALTER TABLE "projects" ADD COLUMN     "approvalMode" "ApprovalMode",
ADD COLUMN     "invoiceApprover" "InvoiceApprover";

-- AlterTable (resolved mode snapshot + upfront counter-offer)
ALTER TABLE "orders" ADD COLUMN     "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'none',
ADD COLUMN     "approvedAmount" DECIMAL(10,2);

-- AlterTable (on_actuals Гейт-2 approval mirror + counter-offer)
ALTER TABLE "service_charges" ADD COLUMN     "approvalStatus" "OrderApprovalStatus",
ADD COLUMN     "approvalDecidedAt" TIMESTAMPTZ(3),
ADD COLUMN     "approvalDecidedById" TEXT,
ADD COLUMN     "approvalComment" TEXT,
ADD COLUMN     "approvedAmount" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_approvalDecidedById_fkey" FOREIGN KEY ("approvalDecidedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
