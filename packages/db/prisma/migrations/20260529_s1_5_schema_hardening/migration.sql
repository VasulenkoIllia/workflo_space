-- S1.5 schema hardening (post-S1 audit, database-reviewer findings)
--
-- Additive + safe (defaults / nullable / index ops). Prepares the schema for
-- S2+ modules (finance/22, leave/23, calendar/24) so they don't need painful
-- column migrations later. Enum creation is outside the transaction (Postgres).

-- ─── Enums (outside transaction) ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

BEGIN;

-- ─── Payment: explicit status (P&L in module 22 filters status='confirmed') ─
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "status" "PaymentStatus" NOT NULL DEFAULT 'confirmed';
CREATE INDEX IF NOT EXISTS payments_confirmedBy_idx ON payments ("confirmedBy");
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments ("status");

-- ─── ExecutorRate: currency + validity window + hireDate ────────────────────
-- currency: P&L salary→USD conversion; effectiveFrom/Until: historical rate
-- tracking; hireDate: leave accrual (module 23).
ALTER TABLE executor_rates
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "effectiveUntil" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMPTZ(3);
CREATE INDEX IF NOT EXISTS executor_rates_executor_effective_idx
  ON executor_rates ("executorId", "effectiveFrom");

-- ─── Missing FK indexes (avoid seq-scans + slow cascade checks) ─────────────
CREATE INDEX IF NOT EXISTS invites_invitedById_idx ON invites ("invitedById");
CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx ON password_reset_tokens ("email");
CREATE INDEX IF NOT EXISTS referrals_referredId_idx ON referrals ("referredId");
CREATE INDEX IF NOT EXISTS order_comments_authorId_idx ON order_comments ("authorId");
CREATE INDEX IF NOT EXISTS documents_createdById_idx ON documents ("createdById");
CREATE INDEX IF NOT EXISTS documents_executorId_idx ON documents ("executorId");
CREATE INDEX IF NOT EXISTS blog_posts_authorId_idx ON blog_posts ("authorId");

-- ─── Drop the useless OtpToken (code, purpose) index ────────────────────────
-- OTP verification queries by (profileId, purpose) — already covered by the
-- unique constraint. Querying by code alone is a misuse/timing-attack pattern.
DROP INDEX IF EXISTS "otp_tokens_code_purpose_idx";

-- ─── Order.company: explicit ON DELETE SET NULL ─────────────────────────────
-- Was implicit NO ACTION (blocked company deletes); align with the cascade
-- pattern — deleting a company nulls the order's companyId (order survives).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS "orders_companyId_fkey";
ALTER TABLE orders
  ADD CONSTRAINT "orders_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES companies (id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── AuditLog.actor: explicit ON DELETE SET NULL ────────────────────────────
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS "audit_logs_actorId_fkey";
ALTER TABLE audit_logs
  ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES profiles (id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Exchange-rate precision headroom: Decimal(8,4) → Decimal(10,4) ─────────
ALTER TABLE exchange_rates ALTER COLUMN "usdToUah" TYPE DECIMAL(10, 4);
ALTER TABLE exchange_rates ALTER COLUMN "eurToUah" TYPE DECIMAL(10, 4);
ALTER TABLE service_charges ALTER COLUMN "uahRate" TYPE DECIMAL(10, 4);

COMMIT;
