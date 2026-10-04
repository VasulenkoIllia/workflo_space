-- S10-03 (спека 02-D): залежності між замовленнями — orderId заблокований,
-- поки dependsOnId не done. DFS cycle-guard на створенні; гейт на → in_progress.

CREATE TABLE "order_dependencies" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_dependencies_orderId_dependsOnId_key" ON "order_dependencies"("orderId", "dependsOnId");
CREATE INDEX "order_dependencies_agencyId_idx" ON "order_dependencies"("agencyId");
CREATE INDEX "order_dependencies_dependsOnId_idx" ON "order_dependencies"("dependsOnId");

ALTER TABLE "order_dependencies" ADD CONSTRAINT "order_dependencies_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_dependencies" ADD CONSTRAINT "order_dependencies_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_dependencies" ADD CONSTRAINT "order_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_dependencies'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
