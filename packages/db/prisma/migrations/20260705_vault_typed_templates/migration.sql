-- 17-Д (Vault typed templates, additive): credential_vault += resourceType (key of
-- VAULT_RESOURCE_TYPES; NULL = legacy freeform row) + publicFields (ordered non-secret
-- fields [{kind,value}]). Secret fields of a typed card live INSIDE the existing
-- ciphertext columns as an encrypted JSON array — no new sensitive storage.

BEGIN;

ALTER TABLE "credential_vault"
  ADD COLUMN "resourceType" TEXT,
  ADD COLUMN "publicFields" JSONB;

COMMIT;
