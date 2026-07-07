-- 02-Б НОМЕНКЛАТУРА + КОШТОРИС (рішення власника 07.07):
--  * Nomenclature — довідник офіційних позицій «згідно КВЕД»; обирається на
--    замовленні/проекті, її назва друкується в рахунках/актах. vatRate закладено
--    на майбутнє (05-Ж) — розрахунок ПДВ поки не реалізований.
--  * OrderEstimateLine — кошторис разового замовлення (к-сть × ціна, з каталогу
--    послуг або вільним рядком); Σ = fixedPrice; друк лише у специфікації.

BEGIN;

CREATE TABLE "nomenclature" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "vatRate" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "nomenclature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nomenclature_agencyId_name_key" ON "nomenclature"("agencyId", "name");
CREATE INDEX "nomenclature_agencyId_idx" ON "nomenclature"("agencyId");
ALTER TABLE "nomenclature" ADD CONSTRAINT "nomenclature_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_estimate_lines" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "order_estimate_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_estimate_lines_agencyId_idx" ON "order_estimate_lines"("agencyId");
CREATE INDEX "order_estimate_lines_orderId_position_idx" ON "order_estimate_lines"("orderId", "position");
CREATE INDEX "order_estimate_lines_serviceId_idx" ON "order_estimate_lines"("serviceId");
ALTER TABLE "order_estimate_lines" ADD CONSTRAINT "order_estimate_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_estimate_lines" ADD CONSTRAINT "order_estimate_lines_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "nomenclatureId" TEXT;
ALTER TABLE "orders" ADD CONSTRAINT "orders_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "nomenclature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "orders_nomenclatureId_idx" ON "orders"("nomenclatureId");

ALTER TABLE "projects" ADD COLUMN "nomenclatureId" TEXT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "nomenclature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "projects_nomenclatureId_idx" ON "projects"("nomenclatureId");

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nomenclature', 'order_estimate_lines'] LOOP
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
