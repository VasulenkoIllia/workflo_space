-- 06-А шаблони документів (рішення власника 06.07: секції з {{змінними}}, всі типи)
-- + PDF-брендинг агенції (лого + акцентний колір).
-- body JSONB: contract → {sections:[{title,body}]}; інші типи → {note?, purpose?}.
-- Один шаблон на тип на агенцію (v1); нема рядка = системний шаблон.

BEGIN;

CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "body" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "document_templates_agencyId_type_key" ON "document_templates"("agencyId", "type");
CREATE INDEX "document_templates_agencyId_idx" ON "document_templates"("agencyId");
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_templates'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

-- PDF-брендинг: лого в storage (key) + акцентний hex-колір
ALTER TABLE "agencies" ADD COLUMN "pdfLogoKey" TEXT;
ALTER TABLE "agencies" ADD COLUMN "pdfAccentColor" TEXT;

COMMIT;
