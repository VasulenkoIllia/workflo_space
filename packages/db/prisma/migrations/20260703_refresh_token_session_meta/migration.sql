-- S9-02 sessions: session identity + device metadata on refresh tokens.
-- familyId is stable across rotations (one familyId = one device session);
-- firstIssuedAt is the original sign-in time, carried through rotations.
ALTER TABLE "refresh_tokens"
  ADD COLUMN "familyId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "firstIssuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows: the best guess for their sign-in time is their creation time.
UPDATE "refresh_tokens" SET "firstIssuedAt" = "createdAt";

-- Prisma's @default(uuid()) is CLIENT-side — the column must carry no DB default
-- (migrate diff flags it as drift). The default above only served the backfill.
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" DROP DEFAULT;
