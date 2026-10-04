-- S1-00: Multi-company per profile
--
-- Before: Company has unique ownerId → 1 profile = 1 company.
-- After:  Ownership derived from CompanyMember.role='owner' with a partial unique index
--         so a profile can own multiple companies (one row per company) but never has
--         duplicate ownership of the same company row.
--
-- Backfill: each existing companies.owner_id row becomes a company_members row with role='owner'.
-- Sanity check at the end ensures no orphaned companies (every company has exactly one owner).

BEGIN;

-- 1. Create the partial unique index FIRST, so the backfill INSERT below is
--    itself constrained — at most one owner per company can ever be written,
--    even if the migration is interrupted and retried. (Old data has no
--    owner-role rows, so the index builds on an empty owner-set.)
CREATE UNIQUE INDEX IF NOT EXISTS company_members_one_owner_per_company
  ON company_members ("companyId")
  WHERE role = 'owner';

-- 2. Backfill: for every company that has an owner_id, ensure a matching
--    company_members(role='owner') row exists. ON CONFLICT keeps any existing
--    membership row but upgrades its role to 'owner' if it was 'member'.
INSERT INTO company_members (id, "companyId", "profileId", role, permissions, "joinedAt")
SELECT
  gen_random_uuid(),
  c.id,
  c."ownerId",
  'owner'::"CompanyMemberRole",
  '{}'::jsonb,
  COALESCE(c."createdAt", NOW())
FROM companies c
WHERE c."ownerId" IS NOT NULL
ON CONFLICT ("companyId", "profileId") DO UPDATE
  SET role = 'owner'::"CompanyMemberRole";

-- 3. Sanity check: every company must have exactly one owner.
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM (
    SELECT "companyId"
    FROM company_members
    WHERE role = 'owner'
    GROUP BY "companyId"
    HAVING COUNT(*) <> 1
  ) sub;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'S1-00 migration: % companies have <> 1 owner after backfill', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM companies c
  WHERE NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm."companyId" = c.id AND cm.role = 'owner'
  );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'S1-00 migration: % companies have no owner row in company_members', bad_count;
  END IF;
END $$;

-- 4. Drop the old constraint + column.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS "companies_ownerId_fkey";
DROP INDEX IF EXISTS "companies_ownerId_key";
ALTER TABLE companies DROP COLUMN IF EXISTS "ownerId";

-- 5. Helpful index for "list my companies" query.
CREATE INDEX IF NOT EXISTS company_members_profile_role_idx
  ON company_members ("profileId", role);

COMMIT;
