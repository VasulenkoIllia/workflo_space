-- 29 SUPPORT MVP (рішення власника 07.07): тікети підтримки — звернення клієнта ПОЗА
-- замовленням. Ticket + TicketMessage (thread з isInternal leak-guard, як OrderComment).
-- Статуси open/pending/resolved/closed, пріоритети low/normal/high/urgent. RLS обидві.

BEGIN;

CREATE TYPE "TicketStatus" AS ENUM ('open', 'pending', 'resolved', 'closed');
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyId" TEXT,
    "openedById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "assignedToId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "firstResponseAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tickets_agencyId_status_idx" ON "tickets"("agencyId", "status");
CREATE INDEX "tickets_companyId_idx" ON "tickets"("companyId");
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_messages_agencyId_idx" ON "ticket_messages"("agencyId");
CREATE INDEX "ticket_messages_ticketId_createdAt_idx" ON "ticket_messages"("ticketId", "createdAt");
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tickets', 'ticket_messages'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

COMMIT;

-- company relation (FK, nullable) — черга workspace показує назву компанії
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- author relation (FK) — leak-guard-серіалізатор читає author.agencyMemberships
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
