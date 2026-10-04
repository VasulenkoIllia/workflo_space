-- Audit r4: comment_reactions (додана 20260704_comment_reactions_edit) не була
-- зарахована в RLS-backstop F4 (20260603_f4_rls_policies). Це child-таблиця без
-- власного agencyId → політика join-иться до order_comments.agencyId, як інші
-- parent-scoped таблиці (order_stages/order_chat_reads → orders.agencyId).
--
-- Прозоро як і решта F4: wf_in_tenant() ПЕРМІСИВНА коли GUC app.current_agency_id
-- не заданий (owner/migrate/worker), тож нічого не ламає до RLS_ENFORCED-флипу.

BEGIN;

ALTER TABLE "comment_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comment_reactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "comment_reactions";
CREATE POLICY tenant_isolation ON "comment_reactions"
  USING (EXISTS (
    SELECT 1 FROM order_comments c
    WHERE c.id = "comment_reactions"."commentId" AND wf_in_tenant(c."agencyId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM order_comments c
    WHERE c.id = "comment_reactions"."commentId" AND wf_in_tenant(c."agencyId")
  ));

COMMIT;
