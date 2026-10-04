# WORKFLO.SPACE — Legal (DRAFT / placeholders)

> ⚠️ **PHASE-1-BLOCKER DRAFT — needs a lawyer before selling.** A white-label SaaS that
> stores OTHER agencies' clients' personal + financial data (and credentials, module 17)
> cannot onboard external tenants without these. Tracked here as first-class artifacts so
> they don't stay invisible deferred mentions.

## Documents to produce (before first external tenant)

| Doc                                  | Why                                                                                                          | Status  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------- |
| `privacy-policy.md`                  | GDPR/UA data-protection: what we collect, why, retention, rights                                             | 🔲 stub |
| `terms-of-service.md`                | Acceptable use, liability, termination, governing law                                                        | 🔲 stub |
| `dpa.md` (Data Processing Agreement) | We are a **processor** for tenant agencies (they are controllers of their clients' data); sub-processor list | 🔲 stub |
| `cookie-policy.md`                   | Cookie consent (landing)                                                                                     | 🔲 stub |
| `subprocessors.md`                   | Hetzner, email/SMTP, Telegram, payment MoR (Paddle/Stripe), Sentry                                           | 🔲 stub |

## Key positions to decide (with counsel)

- **Controller vs processor roles** per data category (tenant's own data vs tenant's
  clients' data — workflo is processor for the latter; the agency is controller).
- **Data residency:** Hetzner EU. State it; relevant for GDPR + tenant trust.
- **Retention:** align with `docs/RETENTION.md` (audit logs 365d, etc.) — must match the
  privacy policy verbatim.
- **GDPR rights wiring:** export + delete must exist as features (tenant lifecycle —
  see `LIFECYCLE.md` Agency-level section) before promising them in the policy.
- **MoR & tax:** if Paddle/LemonSqueezy (see `PRICING.md` §5), they are merchant-of-record
  and handle VAT — reflect in ToS billing terms.

> These are scaffolds, not legal advice. Engage counsel for the actual text.
