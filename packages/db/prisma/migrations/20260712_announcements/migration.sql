-- ANNOUNCEMENTS (07-В, Фаза B, 2026-07-11): оголошення агенції — sticky-банер у
-- workspace/порталі за аудиторією + read-receipt + % прочитань в owner-адмінці.
-- Дата 20260712 — свідомо пізніша за всі наявні (урок same-day-order).

CREATE TYPE "AnnouncementAudience" AS ENUM ('team', 'clients', 'all');

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'all',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_agencyId_published_idx" ON "announcements"("agencyId", "published");
CREATE UNIQUE INDEX "announcement_reads_announcementId_profileId_key" ON "announcement_reads"("announcementId", "profileId");
CREATE INDEX "announcement_reads_agencyId_idx" ON "announcement_reads"("agencyId");
CREATE INDEX "announcement_reads_profileId_idx" ON "announcement_reads"("profileId");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['announcements', 'announcement_reads'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
