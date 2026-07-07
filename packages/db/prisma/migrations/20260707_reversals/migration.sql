-- 05-В СТОРНУВАННЯ / ПОВЕРНЕННЯ / СПИСАННЯ (рішення власника 07.07):
--  * PaymentRefund — повне/часткове повернення підтвердженого платежу (amountUsd — знімок
--    для moneyBalance; повне повернення → Payment.status='refunded'). Клавбек company-бонусу.
--  * ServiceCharge write-off — status='written_off' (вже виключений з боргу, AR-12) + аудит
--    хто/коли/чому. Кредит-нота = ServiceCharge з kind='credit_note' і негативним totalAmount.
-- Енуми refunded/written_off та WalletTxnSource='refund' уже існують.

BEGIN;

ALTER TABLE "service_charges" ADD COLUMN "writeOffReason" TEXT;
ALTER TABLE "service_charges" ADD COLUMN "writtenOffAt" TIMESTAMPTZ(3);
ALTER TABLE "service_charges" ADD COLUMN "writtenOffById" TEXT;

CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "amountUsd" DECIMAL(10,2),
    "reason" TEXT,
    "method" TEXT,
    "refundedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_refunds_agencyId_idx" ON "payment_refunds"("agencyId");
CREATE INDEX "payment_refunds_paymentId_idx" ON "payment_refunds"("paymentId");
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_refunds'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

COMMIT;
