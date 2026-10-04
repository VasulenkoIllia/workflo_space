-- 18-хвости (chat-hub): (1) conversation_state — per-user mute/archive стан треду
-- замовлення (muted глушить chat.new_comment у воркері; @mention пробиває mute свідомо);
-- (2) orders.chatOwnerId — відповідальний за тред (18-В; null = «авто» = перший assignee).

BEGIN;

ALTER TABLE "orders" ADD COLUMN "chatOwnerId" TEXT;

CREATE TABLE "conversation_state" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "conversation_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_state_profileId_orderId_key" ON "conversation_state"("profileId", "orderId");
CREATE INDEX "conversation_state_orderId_muted_idx" ON "conversation_state"("orderId", "muted");
CREATE INDEX "conversation_state_agencyId_idx" ON "conversation_state"("agencyId");

ALTER TABLE "conversation_state" ADD CONSTRAINT "conversation_state_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_state" ADD CONSTRAINT "conversation_state_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: new tenant table → ENABLE/FORCE + tenant_isolation (F4, wf_in_tenant).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversation_state'] LOOP
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
