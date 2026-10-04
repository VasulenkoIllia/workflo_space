-- ХВІСТ-4 (07.07): кастомні стадії воронки лідів per-agency (LeadStage). status лишається
-- coarse-прапорцем результату (open→new/won/lost); stageId стає істиною колонки дошки.

BEGIN;

CREATE TYPE "LeadStageKind" AS ENUM ('open', 'won', 'lost');

CREATE TABLE "lead_stages" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LeadStageKind" NOT NULL DEFAULT 'open',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "lead_stages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lead_stages_agencyId_name_key" ON "lead_stages"("agencyId", "name");
CREATE INDEX "lead_stages_agencyId_idx" ON "lead_stages"("agencyId");
ALTER TABLE "lead_stages" ADD CONSTRAINT "lead_stages_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads" ADD COLUMN "stageId" TEXT;
CREATE INDEX "leads_stageId_idx" ON "leads"("stageId");
ALTER TABLE "leads" ADD CONSTRAINT "leads_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "lead_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: 6 дефолтних стадій кожній агенції (дзеркало наявного фікс-enum).
INSERT INTO "lead_stages" ("id", "agencyId", "name", "kind", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid(), a."id", v.name, v.kind::"LeadStageKind", v.position, now(), now()
FROM "agencies" a
CROSS JOIN (VALUES
  ('Новий', 'open', 0),
  ('Сконтактовано', 'open', 1),
  ('Кваліфіковано', 'open', 2),
  ('Пропозиція', 'open', 3),
  ('Виграно', 'won', 4),
  ('Втрачено', 'lost', 5)
) AS v(name, kind, position);

-- Backfill: кожен лід → стадія на позиції, що відповідає його status.
UPDATE "leads" l
SET "stageId" = s."id"
FROM "lead_stages" s
WHERE s."agencyId" = l."agencyId"
  AND s."position" = CASE l."status"
    WHEN 'new' THEN 0
    WHEN 'contacted' THEN 1
    WHEN 'qualified' THEN 2
    WHEN 'proposal' THEN 3
    WHEN 'won' THEN 4
    WHEN 'lost' THEN 5
  END;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE lead_stages FORCE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON lead_stages;';
  EXECUTE 'CREATE POLICY tenant_isolation ON lead_stages USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));';
END $$;

COMMIT;
