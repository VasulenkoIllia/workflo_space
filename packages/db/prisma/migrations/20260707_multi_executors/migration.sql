-- МУЛЬТИВИКОНАВЦІ (рішення власника 07.07): співвиконавці замовлення/задачі ДОДАТКОВО
-- до головного (assigneeId лишається «відповідальним» — SLA/комісія/chat-owner/«мої»).
-- Час засікає будь-який член команди (TimeLog.executorId per-рядок — маржа/години вже multi).

BEGIN;

CREATE TABLE "order_assignees" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_assignees_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_assignees_orderId_profileId_key" ON "order_assignees"("orderId", "profileId");
CREATE INDEX "order_assignees_agencyId_idx" ON "order_assignees"("agencyId");
CREATE INDEX "order_assignees_profileId_idx" ON "order_assignees"("profileId");
ALTER TABLE "order_assignees" ADD CONSTRAINT "order_assignees_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_assignees" ADD CONSTRAINT "order_assignees_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "internal_task_assignees" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_task_assignees_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "internal_task_assignees_taskId_profileId_key" ON "internal_task_assignees"("taskId", "profileId");
CREATE INDEX "internal_task_assignees_agencyId_idx" ON "internal_task_assignees"("agencyId");
CREATE INDEX "internal_task_assignees_profileId_idx" ON "internal_task_assignees"("profileId");
ALTER TABLE "internal_task_assignees" ADD CONSTRAINT "internal_task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "internal_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_task_assignees" ADD CONSTRAINT "internal_task_assignees_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_assignees', 'internal_task_assignees'] LOOP
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
