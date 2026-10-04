-- S10-01 (спека 02-orders): каталог тегів замовлень + шаблони замовлень.
-- order_tag_assignments несе agencyId заради уніформного RLS (wf_in_tenant).

BEGIN;

CREATE TABLE "order_tags" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_tags_agencyId_name_key" ON "order_tags"("agencyId", "name");
CREATE INDEX "order_tags_agencyId_idx" ON "order_tags"("agencyId");
ALTER TABLE "order_tags" ADD CONSTRAINT "order_tags_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_tag_assignments" (
    "orderId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    CONSTRAINT "order_tag_assignments_pkey" PRIMARY KEY ("orderId", "tagId")
);
CREATE INDEX "order_tag_assignments_tagId_idx" ON "order_tag_assignments"("tagId");
CREATE INDEX "order_tag_assignments_agencyId_idx" ON "order_tag_assignments"("agencyId");
ALTER TABLE "order_tag_assignments" ADD CONSTRAINT "order_tag_assignments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_tag_assignments" ADD CONSTRAINT "order_tag_assignments_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "order_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_tag_assignments" ADD CONSTRAINT "order_tag_assignments_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_templates" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrderType" NOT NULL DEFAULT 'client_order',
    "defaultTitle" TEXT NOT NULL,
    "defaultDescription" TEXT,
    "defaultBillingType" "BillingType" NOT NULL DEFAULT 'fixed',
    "defaultPrice" DECIMAL(10,2),
    "defaultStages" JSONB,
    "nomenclatureCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "order_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_templates_agencyId_name_key" ON "order_templates"("agencyId", "name");
CREATE INDEX "order_templates_agencyId_idx" ON "order_templates"("agencyId");
ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: нові tenant-таблиці → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_tags', 'order_tag_assignments', 'order_templates'] LOOP
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
