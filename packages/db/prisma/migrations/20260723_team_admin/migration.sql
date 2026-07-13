-- TEAM-ADMIN-1: тімлід підрозділу + команда проекту
ALTER TABLE "teams" ADD COLUMN "leadId" TEXT;
ALTER TABLE "teams" ADD CONSTRAINT "teams_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "teams_leadId_idx" ON "teams"("leadId");

ALTER TABLE "projects" ADD COLUMN "teamId" TEXT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "projects_teamId_idx" ON "projects"("teamId");
