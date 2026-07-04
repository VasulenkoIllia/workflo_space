-- Audit r4: TOTP replay guard (RFC 6238 §5.2). Track the last accepted TOTP step
-- per profile so a valid code can be used at most once (verifyChallenge rejects a
-- step <= lastTotpStep). NULL = no code accepted yet (permissive first use).
ALTER TABLE "two_factor_auth" ADD COLUMN "lastTotpStep" INTEGER;
