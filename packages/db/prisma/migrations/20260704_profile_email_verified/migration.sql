-- S9 email-verify: when the mailbox ownership was proven (null = unverified).
ALTER TABLE "profiles" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3);

-- Grandfather every existing profile: they predate verification (seeded, invited,
-- or long-standing) — leaving them null would nag/gate accounts that never had a
-- chance to verify. Only NEW registrations start unverified.
UPDATE "profiles" SET "emailVerifiedAt" = "createdAt";
