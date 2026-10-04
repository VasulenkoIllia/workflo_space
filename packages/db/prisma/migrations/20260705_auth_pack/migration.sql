-- Auth-пачка (01-А/Б/Г/Д): lockout-лічильники, pendingEmail для зміни адреси,
-- mustChangePassword, нові OTP-призначення (magic_link, email_change).

BEGIN;

ALTER TABLE "profiles"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMPTZ(3),
  ADD COLUMN "pendingEmail" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'magic_link';
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'email_change';

COMMIT;
