-- ПРИЙМАННЯ РОБОТИ (рішення власника 07.07): виконавець здає замовлення (in_progress→review),
-- owner/manager приймає (review→done, гейт ролей). На прийманні owner/manager коригує:
--  • billableHours — год ДО ВИСТАВЛЕННЯ клієнту (погодинне; null = факт Σ TimeLog);
--  • per-executor payableHours (order_executor_settlements) — год ДО ОПЛАТИ виконавцю.
-- Факт (Σ TimeLog) ніколи не редагується — це правда/статистика (план = estimatedHours).

BEGIN;

-- Acceptance-поля замовлення
ALTER TABLE "orders" ADD COLUMN "submittedAt" TIMESTAMPTZ(3);
ALTER TABLE "orders" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "orders" ADD COLUMN "acceptedAt" TIMESTAMPTZ(3);
ALTER TABLE "orders" ADD COLUMN "acceptedById" TEXT;
ALTER TABLE "orders" ADD COLUMN "billableHours" DECIMAL(8,2);
ALTER TABLE "orders" ADD CONSTRAINT "orders_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- По-виконавцева звірка оплатних годин
CREATE TABLE "order_executor_settlements" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "trackedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "payableHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "order_executor_settlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_executor_settlements_orderId_profileId_key" ON "order_executor_settlements"("orderId", "profileId");
CREATE INDEX "order_executor_settlements_agencyId_idx" ON "order_executor_settlements"("agencyId");
CREATE INDEX "order_executor_settlements_profileId_idx" ON "order_executor_settlements"("profileId");
ALTER TABLE "order_executor_settlements" ADD CONSTRAINT "order_executor_settlements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_executor_settlements" ADD CONSTRAINT "order_executor_settlements_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE order_executor_settlements ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE order_executor_settlements FORCE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON order_executor_settlements;';
  EXECUTE 'CREATE POLICY tenant_isolation ON order_executor_settlements USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));';
END $$;

COMMIT;
