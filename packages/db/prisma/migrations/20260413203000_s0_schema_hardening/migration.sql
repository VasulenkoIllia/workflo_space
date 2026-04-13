ALTER TABLE "internal_tasks"
ADD CONSTRAINT "internal_tasks_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_confirmedBy_fkey"
FOREIGN KEY ("confirmedBy") REFERENCES "profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_counters"
DROP CONSTRAINT "document_counters_pkey";

ALTER TABLE "document_counters"
ADD CONSTRAINT "document_counters_pkey" PRIMARY KEY ("type", "year");

CREATE INDEX "orders_createdById_idx" ON "orders"("createdById");

CREATE INDEX "internal_tasks_assigneeId_idx" ON "internal_tasks"("assigneeId");

CREATE UNIQUE INDEX "documents_companyId_type_number_key"
ON "documents"("companyId", "type", "number");

CREATE UNIQUE INDEX "otp_tokens_profileId_purpose_key"
ON "otp_tokens"("profileId", "purpose");
