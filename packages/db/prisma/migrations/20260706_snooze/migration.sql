-- 18-Б snooze: «відкласти розмову до часу X». Поки snoozedUntil у майбутньому —
-- тред схований з основних фільтрів хабу; після — повертається з ⏰-маркером
-- («повернути непрочитаною» = повернути в поле уваги). NULL = не відкладено.

BEGIN;

ALTER TABLE "conversation_state" ADD COLUMN "snoozedUntil" TIMESTAMPTZ(3);

COMMIT;
