-- 24 CALENDAR MVP (рішення власника 07.07): зустрічі команда↔команда і команда↔клієнт.
-- CalendarEvent + CalendarAttendee (лише Profile-запрошені; зовнішні гості — Фаза 2).
-- Дедлайни/відпустки — read-only проєкції у /calendar/view. timezone IANA per-event.

BEGIN;

CREATE TYPE "CalendarEventType" AS ENUM ('internal_meeting', 'client_meeting');
CREATE TYPE "AttendeeResponse" AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    "location" TEXT,
    "meetingUrl" TEXT,
    "companyId" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calendar_events_agencyId_startsAt_idx" ON "calendar_events"("agencyId", "startsAt");
CREATE INDEX "calendar_events_companyId_startsAt_idx" ON "calendar_events"("companyId", "startsAt");
CREATE INDEX "calendar_events_createdById_idx" ON "calendar_events"("createdById");
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "calendar_attendees" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "response" "AttendeeResponse" NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_attendees_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "calendar_attendees_eventId_profileId_key" ON "calendar_attendees"("eventId", "profileId");
CREATE INDEX "calendar_attendees_agencyId_idx" ON "calendar_attendees"("agencyId");
CREATE INDEX "calendar_attendees_profileId_eventId_idx" ON "calendar_attendees"("profileId", "eventId");
ALTER TABLE "calendar_attendees" ADD CONSTRAINT "calendar_attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_attendees" ADD CONSTRAINT "calendar_attendees_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendar_events', 'calendar_attendees'] LOOP
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

-- Бекфіл preference-рядків для нових категорій (SUPPORT з 29, CALENDAR з 24) — наявні
-- користувачі мали 0 рядків цих категорій → in-app-нотифікації мовчки губились. Резолвер
-- тепер дефолтить in-app для «неконфігурованої» категорії, але явні рядки тримають
-- матрицю налаштувань консистентною.
INSERT INTO "notification_preferences" ("id", "settingsId", "category", "channel", "enabled", "updatedAt")
SELECT gen_random_uuid(), s."id", cat.category, ch.channel, true, now()
FROM "notification_settings" s
CROSS JOIN (VALUES ('support'), ('calendar')) AS cat(category)
CROSS JOIN (VALUES ('email'), ('telegram'), ('in_app')) AS ch(channel)
ON CONFLICT ("settingsId", "category", "channel") DO NOTHING;
