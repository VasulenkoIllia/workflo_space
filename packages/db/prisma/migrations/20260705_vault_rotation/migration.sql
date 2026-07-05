-- 17-РОТАЦІЯ (спека §D, additive): credential_vault += expiresAt (термін дії доступу,
-- опційний) + rotationRemindedAt (анти-спам: нагадування власнику не частіше 1/7днів).
-- Щоденний cron шле in-app нагадування credentials.rotation_due, коли секрету лишилось
-- ≤7 днів або термін минув.

BEGIN;

ALTER TABLE "credential_vault"
  ADD COLUMN "expiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "rotationRemindedAt" TIMESTAMPTZ(3);

CREATE INDEX "credential_vault_expiresAt_idx" ON "credential_vault"("expiresAt") WHERE "expiresAt" IS NOT NULL;

COMMIT;
