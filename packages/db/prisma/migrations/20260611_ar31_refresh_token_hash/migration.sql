-- S5.5 AR-31 (повний аудит 2026-06-11): refresh tokens at rest → sha256 digests.
-- The code now stores/looks up sha256(token) (apps/api/src/auth/tokens.ts), so
-- existing RAW tokens are upgraded IN PLACE — live sessions survive the deploy.
--
-- Raw tokens are 43-char base64url (256-bit); digests are 64-char hex. The length
-- guard makes this idempotent and skips rows that are already hashed.
-- sha256() is a Postgres built-in (PG11+); no pgcrypto needed.

UPDATE "refresh_tokens"
SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
WHERE length("token") <> 64;
