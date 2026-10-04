-- АВТО-РАХУНОК (рішення власника 07.07): разове замовлення (без проекту) перейшло у
-- done → автоматична ЧЕРНЕТКА рахунку (draft) + in-app власнику «перевір і надішли».
-- fixed = approvedAmount ?? fixedPrice ?? totalAmount; hourly = Σ TimeLog.hours × ставка.
-- Per-agency тумблер, УВІМКНЕНО за замовчуванням (чернетка нешкідлива).

BEGIN;
ALTER TABLE "agencies" ADD COLUMN "autoInvoiceOneTime" BOOLEAN NOT NULL DEFAULT true;
COMMIT;
