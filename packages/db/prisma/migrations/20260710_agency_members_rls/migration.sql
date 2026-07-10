-- RLS-БОРГ (аудит r4→r5, закрито 2026-07-10): agency_members — остання agencyId-таблиця
-- без tenant_isolation. App-layer гарди покривали; це БД-backstop, як на решті таблиць.
--
-- Безпека auth-hot-path (перевірено перед міграцією):
--  • login/refresh/switch-agency читають memberships через RAW prisma БЕЗ tenant-контексту →
--    GUC unset → wf_in_tenant permissive → повний список memberships профіля, як і було;
--  • enterAgencyContext біндить GUC лише при RLS_ENFORCED=true (зараз off) — політика
--    стає активною межею разом із загальним enforce, до того — no-op backstop;
--  • крос-агенційний accept-invite (створення membership агенції B під GUC=A) захищено
--    app-фіксом: upsert біндиться на агенцію ІНВАЙТА (runWithAgency) — див. acceptInvite.ts.

DO $$
BEGIN
  EXECUTE 'ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'ALTER TABLE agency_members FORCE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON agency_members;';
  EXECUTE 'CREATE POLICY tenant_isolation ON agency_members USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));';
END $$;
