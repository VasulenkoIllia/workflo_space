-- ХВОСТИ-2 (S9-06 + S12-05): контакт/часовий пояс профілю + suppression-список email.
-- Обидва — identity-рівень (без tenant-RLS, як profiles/refresh_tokens).

ALTER TABLE "profiles"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "timezone" TEXT;

CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");
