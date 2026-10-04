-- S1.6 telegram dedup (module 15): NotificationSettings.telegramChatId is the
-- single source of truth for Telegram linkage. The duplicate Profile.telegram*
-- columns are unused by application code (all reads go through
-- NotificationSettings) — drop them. Idempotent (IF EXISTS). Dropping
-- telegramChatId also removes its unique index.

BEGIN;

ALTER TABLE "profiles"
  DROP COLUMN IF EXISTS "telegramChatId",
  DROP COLUMN IF EXISTS "telegramConnected",
  DROP COLUMN IF EXISTS "telegramOtp",
  DROP COLUMN IF EXISTS "telegramOtpExpiresAt";

COMMIT;
