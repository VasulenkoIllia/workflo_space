-- 17-SHARE (спека §C + рішення власника 05.07): executor access grants for the vault.
-- One row = owner grants an executor either ONE secret (credentialId) or ALL secrets of a
-- client company (companyId, covers future secrets). Indefinite until revokedAt; expiresAt
-- kept for the spec's auto-expiry (checked by the access path, not issued by UI yet).

BEGIN;

CREATE TABLE "credential_shares" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "credentialId" TEXT,
    "companyId" TEXT,
    "executorId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credential_shares_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credential_shares_executorId_revokedAt_idx" ON "credential_shares"("executorId", "revokedAt");
CREATE INDEX "credential_shares_credentialId_idx" ON "credential_shares"("credentialId");
CREATE INDEX "credential_shares_agencyId_companyId_idx" ON "credential_shares"("agencyId", "companyId");

ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "credential_vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: new tenant table → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['credential_shares'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

COMMIT;
