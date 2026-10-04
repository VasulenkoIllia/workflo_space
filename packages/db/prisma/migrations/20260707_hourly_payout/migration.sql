-- PAYROLL погодинна оплата (07.07, замикає money-loop приймання): у місячному payout
-- зʼявляється hourlyEarned = paidHours × ExecutorRate.hourlyRate. paidHours — сума ПРИЙНЯТИХ
-- payableHours (OrderExecutorSettlement) по замовленнях, прийнятих (acceptedAt) у періоді.
-- billableHours (Σ TimeLog, залоговано) лишається окремо для інформації.

BEGIN;

ALTER TABLE "executor_payouts" ADD COLUMN "paidHours" DECIMAL(8,2) NOT NULL DEFAULT 0;

COMMIT;
