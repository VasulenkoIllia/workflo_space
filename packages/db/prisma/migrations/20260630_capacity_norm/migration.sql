-- 12-ПЛАН-ФАКТ (capacity norm): per-member planned billable hours/week, for the hours
-- plan-vs-actual report's utilization level. ADDITIVE, nullable (null → agency default).

ALTER TABLE "agency_members" ADD COLUMN "weeklyCapacityHours" INTEGER;
