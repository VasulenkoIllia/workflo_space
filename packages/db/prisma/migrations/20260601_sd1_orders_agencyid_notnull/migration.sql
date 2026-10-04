-- S-D1 (AUDIT_S0_S2 / ADR-007): orders.agencyId → NOT NULL + FK RESTRICT.
-- Tenant key must never be null (S1.6 backfilled all rows). RESTRICT instead of
-- SET NULL so deleting an Agency can't silently orphan its orders (which would
-- become invisible to every tenant via assertSameTenant(null)→deny). Idempotent.

BEGIN;

-- Safety backfill: any stray NULL → platform agency (no-op once S1.6 ran / on prod).
UPDATE "orders"
SET "agencyId" = (SELECT "id" FROM "agencies" WHERE "slug" = 'workflo' LIMIT 1)
WHERE "agencyId" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "agencyId" SET NOT NULL;

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_agencyId_fkey";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "agencies" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
