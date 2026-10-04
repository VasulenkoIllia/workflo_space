-- Module 17 (Credentials Vault): envelope-encrypted secrets bound to a client company.
-- AES-256-GCM; per-record DEK wrapped by a platform KEK held in env (never in the DB).
-- Plain metadata is queryable; only the secret value is bytea ciphertext. Tenant-scoped
-- (agencyId real FK + RLS wf_in_tenant), company FK cascade, createdBy → profiles.

BEGIN;

CREATE TABLE "credential_vault" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "service" TEXT,
    "url" TEXT,
    "username" TEXT,
    "encryptedDek" BYTEA NOT NULL,
    "dekIv" BYTEA NOT NULL,
    "dekAuthTag" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "ciphertextIv" BYTEA NOT NULL,
    "ciphertextAuthTag" BYTEA NOT NULL,
    "notes" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "credential_vault_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credential_vault_agencyId_idx" ON "credential_vault"("agencyId");
CREATE INDEX "credential_vault_companyId_revokedAt_idx" ON "credential_vault"("companyId", "revokedAt");

ALTER TABLE "credential_vault" ADD CONSTRAINT "credential_vault_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credential_vault" ADD CONSTRAINT "credential_vault_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credential_vault" ADD CONSTRAINT "credential_vault_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: new tenant table → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['credential_vault'] LOOP
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
