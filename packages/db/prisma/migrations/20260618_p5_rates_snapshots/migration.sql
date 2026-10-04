-- S5.6 P-5 — ставки-собівартість + снапшоти на TimeLog (PROJECTS_SPEC §2.2/§2.3, П5/П7).
-- ExecutorRate: hourlyRate (БАЗОВА собівартість години — fallback каскаду §2.3) +
-- zeroCostDefault (owner/партнери = 0). TimeLog: снапшот резолвнутих ставок у момент
-- логування (clientRate/costRate/costCurrency/costRateUsd) — стабільна історія маржі.
-- ADDITIVE (усі поля nullable / з дефолтом). RLS уже на обох таблицях. Назва p5 > p1e.

BEGIN;

-- AlterTable
ALTER TABLE "executor_rates" ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "zeroCostDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "time_logs" ADD COLUMN     "clientRateSnapshot" DECIMAL(10,2),
ADD COLUMN     "costCurrency" TEXT,
ADD COLUMN     "costRateSnapshot" DECIMAL(10,2),
ADD COLUMN     "costRateUsd" DECIMAL(10,2);

COMMIT;
