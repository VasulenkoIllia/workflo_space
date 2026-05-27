-- S1-03: Notification matrix + supporting refactors
--
-- Three concerns bundled together since they all touch enums/notification tables:
--   1. Rename OrderInternalStatus value: 'estimated' → 'estimating' (verb form).
--   2. Add 'reconciliation_act' to DocumentType enum.
--   3. Refactor NotificationSettings: drop flat booleans, add language + telegramChatId.
--      Add NotificationPreference (matrix), NotificationLog (delivery audit),
--      AuditLog (can() denials + sensitive actions).
--
-- All steps are forward-only and idempotent where possible. Each step is reversible
-- with a follow-up migration if needed (see down_<step>.sql siblings — not Prisma-managed).

BEGIN;

-- ─── 1. OrderInternalStatus: rename 'estimated' → 'estimating' ─────────────
-- Postgres ALTER TYPE ... RENAME VALUE is atomic and safe; existing rows are
-- updated transparently.
ALTER TYPE "OrderInternalStatus" RENAME VALUE 'estimated' TO 'estimating';

-- ─── 2. DocumentType: add 'reconciliation_act' ─────────────────────────────
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'reconciliation_act';

-- ─── 3a. NotificationSettings refactor ─────────────────────────────────────
-- Backfill: capture each row's old flat-boolean state, drop them, add the new
-- shape, then we'll create matrix preference rows in step 3b.
CREATE TEMP TABLE IF NOT EXISTS _ns_legacy AS
SELECT id,
       "profileId",
       "emailOnStatusChange",
       "emailOnNewComment",
       "emailOnPayment",
       "telegramOnStatusChange",
       "telegramOnNewComment",
       "telegramOnPayment"
FROM notification_settings;

ALTER TABLE notification_settings DROP COLUMN IF EXISTS "emailOnStatusChange";
ALTER TABLE notification_settings DROP COLUMN IF EXISTS "emailOnNewComment";
ALTER TABLE notification_settings DROP COLUMN IF EXISTS "emailOnPayment";
ALTER TABLE notification_settings DROP COLUMN IF EXISTS "telegramOnStatusChange";
ALTER TABLE notification_settings DROP COLUMN IF EXISTS "telegramOnNewComment";
ALTER TABLE notification_settings DROP COLUMN IF EXISTS "telegramOnPayment";

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS "language" "Language" NOT NULL DEFAULT 'uk',
  ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramLinkedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW();

-- Copy profile language as initial notification language and reuse already-linked Telegram chat.
UPDATE notification_settings ns
SET "language" = p.language,
    "telegramChatId" = p."telegramChatId"
FROM profiles p
WHERE ns."profileId" = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_telegramChatId_key"
  ON notification_settings ("telegramChatId")
  WHERE "telegramChatId" IS NOT NULL;

-- ─── 3b. NotificationPreference matrix table ───────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "settingsId" TEXT NOT NULL REFERENCES notification_settings (id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  channel     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_unique
  ON notification_preferences ("settingsId", category, channel);

CREATE INDEX IF NOT EXISTS notification_preferences_settings_idx
  ON notification_preferences ("settingsId");

-- Seed preferences from legacy flat booleans for each existing settings row.
-- Mapping (legacy → matrix category/channel):
--   email_on_status_change   → (orders,   email)
--   email_on_new_comment     → (chat,     email)
--   email_on_payment         → (billing,  email)
--   telegram_on_status_change→ (orders,   telegram)
--   telegram_on_new_comment  → (chat,     telegram)
--   telegram_on_payment      → (billing,  telegram)
INSERT INTO notification_preferences ("settingsId", category, channel, enabled)
SELECT id, 'orders',  'email',    "emailOnStatusChange"    FROM _ns_legacy
UNION ALL
SELECT id, 'chat',    'email',    "emailOnNewComment"      FROM _ns_legacy
UNION ALL
SELECT id, 'billing', 'email',    "emailOnPayment"         FROM _ns_legacy
UNION ALL
SELECT id, 'orders',  'telegram', "telegramOnStatusChange" FROM _ns_legacy
UNION ALL
SELECT id, 'chat',    'telegram', "telegramOnNewComment"   FROM _ns_legacy
UNION ALL
SELECT id, 'billing', 'telegram', "telegramOnPayment"      FROM _ns_legacy
ON CONFLICT ("settingsId", category, channel) DO NOTHING;

-- Default-on baseline preferences for remaining (category × channel) pairs:
-- every category × {email, telegram, in_app} starts enabled=true so users see
-- in_app + email out of the box. They can opt out from /profile/settings/notifications.
INSERT INTO notification_preferences ("settingsId", category, channel, enabled)
SELECT ns.id, cat.name, ch.name, TRUE
FROM notification_settings ns
CROSS JOIN (VALUES
  ('auth'), ('orders'), ('chat'), ('billing'), ('documents'), ('loyalty'), ('system')
) AS cat(name)
CROSS JOIN (VALUES ('email'), ('telegram'), ('in_app')) AS ch(name)
ON CONFLICT ("settingsId", category, channel) DO NOTHING;

DROP TABLE IF EXISTS _ns_legacy;

-- ─── 3c. NotificationLog (delivery audit) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "settingsId"    TEXT NOT NULL REFERENCES notification_settings (id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  channel         TEXT NOT NULL,
  status          TEXT NOT NULL,
  "errorCode"     TEXT,
  "rollupTargetId" TEXT,
  metadata        JSONB,
  "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_logs_settings_created_idx
  ON notification_logs ("settingsId", "createdAt" DESC);

-- Index used by rollup detection (3+ same-event in last 10s for a recipient).
CREATE INDEX IF NOT EXISTS notification_logs_rollup_idx
  ON notification_logs ("settingsId", event, "createdAt" DESC);

-- ─── 3d. AuditLog ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "actorId"      TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId"   TEXT,
  result         TEXT NOT NULL,
  metadata       JSONB,
  "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs ("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs ("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action, "createdAt" DESC);

COMMIT;
