-- 02-orders T2 (фінд.#7): таймерна модель поверх ручного TimeLog.hours. ADDITIVE.
-- startedAt set + endedAt null = таймер біжить; обидва null = звичайний ручний запис (back-compat).
-- «1 активний таймер на виконавця» гарантується advisory-lock у сервісі (services/timer.ts),
-- НЕ partial-unique БД-індексом — той зламав би prisma migrate diff drift-gate (на відміну від
-- RLS/тригерів, які Prisma не моделює). Композитний індекс нижче — для швидкого active-lookup.

BEGIN;

ALTER TABLE "time_logs" ADD COLUMN "startedAt" TIMESTAMPTZ(3);
ALTER TABLE "time_logs" ADD COLUMN "endedAt" TIMESTAMPTZ(3);

CREATE INDEX "time_logs_executorId_endedAt_idx" ON "time_logs"("executorId", "endedAt");

COMMIT;
