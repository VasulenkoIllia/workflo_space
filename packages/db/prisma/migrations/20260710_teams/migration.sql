-- TEAM-BOARDS (Фаза B, 2026-07-10): команди агенції — таби глобальної дошки задач.
-- Team + AgencyMember.teamId + InternalTask.teamId (SetNull — видалення команди не губить
-- ні людей, ні задачі). Кастомні колонки per-team — follow-up (патерн LeadStage).

CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_agencyId_name_key" ON "teams"("agencyId", "name");
CREATE INDEX "teams_agencyId_idx" ON "teams"("agencyId");

ALTER TABLE "teams" ADD CONSTRAINT "teams_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_members" ADD COLUMN "teamId" TEXT;
CREATE INDEX "agency_members_teamId_idx" ON "agency_members"("teamId");
ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "internal_tasks" ADD COLUMN "teamId" TEXT;
CREATE INDEX "internal_tasks_teamId_idx" ON "internal_tasks"("teamId");
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE teams FORCE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON teams;';
  EXECUTE 'CREATE POLICY tenant_isolation ON teams USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));';
END $$;
