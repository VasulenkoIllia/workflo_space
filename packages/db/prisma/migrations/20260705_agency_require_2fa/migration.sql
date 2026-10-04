-- 2FA-POLICY (рішення власника 05.07): owner-тумблер «вимагати 2FA у команди».
-- requireTwoFactorAt = момент увімкнення політики; грейс 7 днів рахується від нього.
-- NULL = політика вимкнена. Клієнтів порталу політика не стосується.

BEGIN;

ALTER TABLE "agencies" ADD COLUMN "requireTwoFactorAt" TIMESTAMPTZ(3);

COMMIT;
