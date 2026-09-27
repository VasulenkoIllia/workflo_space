-- PERM-1 (рішення власника 27.09.2026): права доступу. Каталог і дефолти ролей — у коді
-- (@workflo/types); тут лише відхилення: матриця ролей агенції + персональні права людини.
-- Адитивно (2 нові таблиці + 2 enum), без backfill: порожні таблиці = чисті дефолти.
-- Rollback: DROP TABLE ×2 + DROP TYPE ×2.

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('none', 'own', 'team', 'all');

-- CreateEnum
CREATE TYPE "PermissionRole" AS ENUM ('manager', 'lead', 'executor');

-- CreateTable
CREATE TABLE "agency_role_permissions" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "role" "PermissionRole" NOT NULL,
    "permission" TEXT NOT NULL,
    "level" "PermissionLevel" NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_member_permissions" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "level" "PermissionLevel" NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_member_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_role_permissions_agencyId_role_permission_key" ON "agency_role_permissions"("agencyId", "role", "permission");

-- CreateIndex
CREATE INDEX "agency_member_permissions_profileId_idx" ON "agency_member_permissions"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "agency_member_permissions_agencyId_profileId_permission_key" ON "agency_member_permissions"("agencyId", "profileId", "permission");

-- AddForeignKey
ALTER TABLE "agency_role_permissions" ADD CONSTRAINT "agency_role_permissions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_member_permissions" ADD CONSTRAINT "agency_member_permissions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_member_permissions" ADD CONSTRAINT "agency_member_permissions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: tenant_isolation, як на решті agencyId-таблиць (backstop до app-гардів).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['agency_role_permissions', 'agency_member_permissions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
