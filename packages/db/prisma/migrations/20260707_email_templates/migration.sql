-- 08-EMAIL (рішення власника 06.07): owner-редаговані email-шаблони — ТЕМА +
-- ВСТУПНИЙ ТЕКСТ поверх системного макета, окремо uk/en, лише БІЗНЕС-листи
-- (auth-критичні листи системні назавжди). {{змінні}} = ключі vars події.
-- Нема рядка = системний текст.

BEGIN;

CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "subject" TEXT,
    "intro" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_templates_agencyId_event_locale_key" ON "email_templates"("agencyId", "event", "locale");
CREATE INDEX "email_templates_agencyId_idx" ON "email_templates"("agencyId");
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_templates'] LOOP
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
