-- S2-prep (audit 31.05): composite tenant indexes on orders for the tenant-scoped
-- list / kanban queries S2 will run (WHERE "agencyId" = ? AND <filter>). The
-- single-column @@index([agencyId]) is kept (serves the prefix). Additive +
-- idempotent. Non-concurrent CREATE is instant at current row counts.

BEGIN;

CREATE INDEX IF NOT EXISTS "orders_agencyId_internalStatus_idx" ON "orders" ("agencyId", "internalStatus");
CREATE INDEX IF NOT EXISTS "orders_agencyId_createdAt_idx"      ON "orders" ("agencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_agencyId_companyId_idx"      ON "orders" ("agencyId", "companyId");

COMMIT;
