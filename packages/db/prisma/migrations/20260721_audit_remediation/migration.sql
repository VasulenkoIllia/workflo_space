-- АУДИТ 2026-07-12 ремедіація: цілісність залежностей + прибирання мертвої колонки + FK-індекси.
-- Нових таблиць нема — RLS не чіпаємо.

-- audit-M5: DB-бекстоп самопосилання залежності (app-шар уже 400'ить; це defense-in-depth
-- на додачу до advisory-lock проти 2-cycle race у routes/orders/dependencies.ts).
ALTER TABLE "order_dependencies"
  ADD CONSTRAINT "order_dependencies_no_self" CHECK ("orderId" <> "dependsOnId");

-- audit-M6: мертва колонка. Accrual відпустки читає AgencyMember.hireDate; цю ж ніхто
-- не читав, а POST /rates мовчки churn'ив її в null на кожній зміні ставки. Прибираємо.
ALTER TABLE "executor_rates" DROP COLUMN "hireDate";

-- audit-M7: індекси під FK на profiles (SET NULL/RESTRICT інакше seq-scan'ять таблицю
-- при видаленні профілю → блокування пропорційне розміру таблиці).
CREATE INDEX "leave_requests_reviewedById_idx" ON "leave_requests"("reviewedById");
CREATE INDEX "broadcasts_createdById_idx" ON "broadcasts"("createdById");
