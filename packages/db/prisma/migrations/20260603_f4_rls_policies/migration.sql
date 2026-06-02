-- F4 (ADR-007 #1): Postgres Row-Level Security — the default-on tenant-isolation
-- backstop beneath the app-layer guards (can()/assertSameTenant/loaders).
--
-- DESIGN — flag-safe rollout:
--   wf_in_tenant(agency) is PERMISSIVE WHEN THE GUC IS UNSET. So enabling RLS here
--   changes NOTHING until the web layer starts setting `app.current_agency_id`
--   per request (gated by RLS_ENFORCED). That means this migration can deploy
--   ahead of the code flip without bricking anything (owner/migrate/worker, which
--   never set the GUC, keep seeing all rows).
--   • Web request  → SET LOCAL app.current_agency_id=<agency> → sees only that tenant.
--   • System ctx   → SET LOCAL app.rls_bypass='on' (worker/seed/bootstrap) → sees all.
--   • GUC unset    → permissive (transitional / non-enforced paths).
-- FORCE so the policy applies even to the table owner (the app's connection),
-- since the flag-gated rollout keeps a single connection role.
--
-- Future DATA migrations (backfills) run as owner with no GUC → permissive, so they
-- are unaffected. If a future migration sets the GUC, it must also set rls_bypass.

BEGIN;

-- Tenant predicate: TRUE when GUC unset (permissive), on bypass, or agency matches.
CREATE OR REPLACE FUNCTION wf_in_tenant(row_agency text) RETURNS boolean AS $$
  SELECT
    nullif(current_setting('app.current_agency_id', true), '') IS NULL
    OR nullif(current_setting('app.rls_bypass', true), '') = 'on'
    OR row_agency = current_setting('app.current_agency_id', true);
$$ LANGUAGE sql STABLE;

-- ── Column-scoped tables (own `agencyId`) ────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies','orders','order_comments','order_files','time_logs','services',
    'service_charges','payments','executor_rates','documents','audit_logs',
    'outbox_events','internal_tasks','activity_logs','invites','document_counters',
    'payment_settings','exchange_rates'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (wf_in_tenant("agencyId")) WITH CHECK (wf_in_tenant("agencyId"));',
      t
    );
  END LOOP;
END $$;

-- ── Parent-scoped tables (no own `agencyId` → join to the owning row) ─────────
-- order children → orders.agencyId
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['order_stages','order_chat_reads'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = %I."orderId" AND wf_in_tenant(o."agencyId"))) WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = %I."orderId" AND wf_in_tenant(o."agencyId")));',
      t, t, t
    );
  END LOOP;
END $$;

-- company children → companies.agencyId
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_members','company_services'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = %I."companyId" AND wf_in_tenant(c."agencyId"))) WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = %I."companyId" AND wf_in_tenant(c."agencyId")));',
      t, t, t
    );
  END LOOP;
END $$;

-- referrals → referrer company's agency
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referrals" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "referrals";
CREATE POLICY tenant_isolation ON "referrals"
  USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = "referrals"."referrerId" AND wf_in_tenant(c."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = "referrals"."referrerId" AND wf_in_tenant(c."agencyId")));

-- referral_bonuses → referral → referrer company's agency
ALTER TABLE "referral_bonuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referral_bonuses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "referral_bonuses";
CREATE POLICY tenant_isolation ON "referral_bonuses"
  USING (EXISTS (
    SELECT 1 FROM referrals r JOIN companies c ON c.id = r."referrerId"
    WHERE r.id = "referral_bonuses"."referralId" AND wf_in_tenant(c."agencyId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM referrals r JOIN companies c ON c.id = r."referrerId"
    WHERE r.id = "referral_bonuses"."referralId" AND wf_in_tenant(c."agencyId")
  ));

-- ── Restricted application role (the RLS-subject web connection) ──────────────
-- RLS does NOT apply to superusers / the owner-without-FORCE. The web layer must
-- connect as THIS non-superuser role for policies to bite. Created NOLOGIN; to
-- activate, grant it LOGIN + a password out-of-band and point DATABASE_APP_URL at
-- it (ENGINEERING_STANDARDS → "RLS rollout"). Migrations/worker/seed keep using the
-- owner/admin connection (which bypasses RLS — exactly as intended).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'workflo_app') THEN
    CREATE ROLE workflo_app NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO workflo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO workflo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO workflo_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO workflo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workflo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO workflo_app;

COMMIT;
