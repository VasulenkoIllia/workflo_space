-- S12-03/06 NOTIFY-пакет: Web Push підписки + тихі години + ранковий дайджест.
-- push_subscriptions — identity-scoped (як refresh_tokens), без tenant-RLS.

CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_profileId_idx" ON "push_subscriptions"("profileId");

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_settings"
  ADD COLUMN "quietFrom" INTEGER,
  ADD COLUMN "quietTo" INTEGER,
  ADD COLUMN "digestDaily" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastDigestAt" TIMESTAMPTZ(3);
