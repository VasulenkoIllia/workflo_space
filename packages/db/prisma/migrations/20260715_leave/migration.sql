-- S13-04/05 LEAVE: заявки на відсутність (self-service → owner/manager approve) +
-- accrual-база балансу (hireDate на члені, річна квота на агенції).

CREATE TYPE "LeaveType" AS ENUM ('vacation', 'sick', 'dayoff', 'unpaid');
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

ALTER TABLE "agencies"
  ADD COLUMN "vacationDaysPerYear" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "agency_members"
  ADD COLUMN "hireDate" DATE;

CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'vacation',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_requests_agencyId_status_idx" ON "leave_requests"("agencyId", "status");
CREATE INDEX "leave_requests_profileId_startDate_idx" ON "leave_requests"("profileId", "startDate");

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['leave_requests'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;
