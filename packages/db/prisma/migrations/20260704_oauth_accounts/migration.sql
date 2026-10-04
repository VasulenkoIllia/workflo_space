-- S9 §E social login: linked external identities (Google first).
CREATE TABLE "oauth_accounts" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_accounts_provider_providerAccountId_key"
  ON "oauth_accounts"("provider", "providerAccountId");
CREATE INDEX "oauth_accounts_profileId_idx" ON "oauth_accounts"("profileId");

ALTER TABLE "oauth_accounts"
  ADD CONSTRAINT "oauth_accounts_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
