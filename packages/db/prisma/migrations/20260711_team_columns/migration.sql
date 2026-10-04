-- TASK-COLUMNS (рішення власника 2026-07-10): кастомні колонки командних дошок з мапінгом
-- kind → канонічний InternalTaskStatus (патерн LeadStage). Drag у колонку дзеркалить
-- status=kind → головна дошка (3 канонічні колонки-якорі) завжди консистентна.
-- InternalTask.columnId SetNull: видалення колонки не губить задачі (fallback свого kind).

CREATE TABLE "team_columns" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InternalTaskStatus" NOT NULL DEFAULT 'todo',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_columns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_columns_teamId_name_key" ON "team_columns"("teamId", "name");
CREATE INDEX "team_columns_agencyId_idx" ON "team_columns"("agencyId");
CREATE INDEX "team_columns_teamId_idx" ON "team_columns"("teamId");

ALTER TABLE "team_columns" ADD CONSTRAINT "team_columns_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_columns" ADD CONSTRAINT "team_columns_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "internal_tasks" ADD COLUMN "columnId" TEXT;
CREATE INDEX "internal_tasks_columnId_idx" ON "internal_tasks"("columnId");
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "team_columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE team_columns ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE team_columns FORCE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON team_columns;';
  EXECUTE 'CREATE POLICY tenant_isolation ON team_columns USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));';
END $$;
