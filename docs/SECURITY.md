# WORKFLO.SPACE — Security Posture & Threat Model (DRAFT)

> ⚠️ **PHASE-1-BLOCKER DRAFT.** Living doc. Must be complete before the first external
> paying tenant stores its clients' financial/credential data. Reflects the 2026-06 audit
> remediation. Report vulnerabilities privately (see §6).

## 1. Trust boundaries

| Boundary        | Actor                   | Control                                                             |
| --------------- | ----------------------- | ------------------------------------------------------------------- |
| Landing → API   | anonymous               | rate-limit, Turnstile/honeypot (contact/lead)                       |
| Portal → API    | client (company member) | JWT Bearer + `can()` + company IDOR guard                           |
| Workspace → API | staff (agency member)   | JWT Bearer + `can()` + IP-whitelist (work.\*)                       |
| API → DB        | app                     | tenant scoping (`assertSameTenant`/loaders) + **RLS** (workflo_app) |
| Bot → API       | Telegram user           | OTP-linked profile                                                  |

## 2. Tenant isolation (the #1 multi-tenant threat)

- **App layer:** `agencyId` stamped from the session (never request body);
  `assertSameTenant` / `requireOrderParticipant` / `requireTeamOrder` on every
  agency-scoped handler; client cross-company access → 404 (no existence leak).
- **DB layer (belt-and-suspenders):** Postgres RLS (F4) — `wf_in_tenant("agencyId")`
  USING + WITH CHECK on all tenant tables; reads AND writes routed through
  `withTenant`/`tenantTransaction` (Block 3); enforced when the web process connects as
  `workflo_app` + `RLS_ENFORCED=true`.
- **Proven:** `apps/api/tests/integration/tenantIsolation.test.ts` (CI gate) — cross-agency
  invisibility + unwritability as `workflo_app`. **This is the hard precondition for
  onboarding any external tenant.**

## 3. AuthN / AuthZ

- JWT access (15m, in-memory on client) + opaque refresh (30d, rotation + reuse-detection,
  `tokenVersion` revoke). Cookie: httpOnly, SameSite=Lax, Path=/auth/refresh (ADR-001).
- CSRF: `/auth/refresh` validates Origin against the shared allowlist (`config/origins.ts`,
  same as CORS — can't diverge/fail-open). Auth endpoints rate-limited.
- Passwords: bcrypt; generic 401 (no account enumeration); timing-equalized.
- RBAC: `can()` shim over `CompanyMember.permissions` + tenant-guard (ADR-002/004).

## 4. Data handling

- **Files:** path-traversal guard (`safeResolve`), MIME allowlist, forced
  `Content-Disposition: attachment` + `nosniff`, 0640 perms, sha256.
  - 🔲 **TODO (audit, low):** magic-bytes verification (client `Content-Type` is trusted
    today) — add `file-type` check in `routes/files/index.ts`. 🔲 virus-scan (BACKLOG).
- **Secrets:** never logged; env-validated at boot; `.env.example` documents all vars.
  Credentials vault (module 17) = envelope AES-256-GCM (S9).
- **PII:** Sentry `sendDefaultPii=false`; structured logs scrub on the way.

## 5. Known gaps / pre-external-tenant checklist

- [ ] RLS activated + soaked on staging (workflo_app + RLS_ENFORCED) a full sprint.
- [ ] File magic-bytes verification.
- [ ] Outbound webhook SSRF guard (module 27) before shipping webhooks.
- [ ] Outbox idempotency-key before any money handler (at-least-once → exactly-once).
- [ ] 2FA (S9), GDPR export/delete (tenant lifecycle, LIFECYCLE.md).
- [ ] Dependency CVE scan in CI; secret-scanning.

## 6. Reporting

Security contact: security@workflo.space (set up before launch). Do not file public issues
for vulnerabilities.
