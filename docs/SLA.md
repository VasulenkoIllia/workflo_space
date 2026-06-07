# WORKFLO.SPACE — SLA / SLO (DRAFT)

> ⚠️ **PHASE-1-BLOCKER DRAFT.** A reselling agency will demand uptime commitments.
> Targets below are internal SLOs (engineering goals), not yet a contractual SLA.
> Promote to a contractual SLA (with credits) before the first paying external tenant.

## Internal SLOs (targets)

| Metric                 | Target                                   | Source                  |
| ---------------------- | ---------------------------------------- | ----------------------- |
| API availability       | 99.0% / month (MVP) → 99.5% (SaaS)       | UptimeRobot + `/health` |
| p95 latency (reads)    | < 1s                                     | Pino timing / metrics   |
| p95 latency (writes)   | < 2s                                     | Pino timing / metrics   |
| Email delivery success | > 95% / day                              | NotificationLog         |
| Telegram delivery      | > 90% (excl. blocked)                    | NotificationLog         |
| RPO (data loss window) | ≤ 24h (daily backup) → ≤ 1h (PITR later) | backup cron             |
| RTO (restore time)     | ≤ 4h                                     | tested restore runbook  |

## Status & incidents

- Public status page: module 21 `StatusIncident` (NOT yet built — pre-launch checklist).
- Severity model (SEV1/2/3) + on-call runbook: see module 21 §7 + S8-07 (to be written).

## Gaps before a contractual SLA (audit P5/ops)

- [ ] External uptime probe (UptimeRobot) + lightweight host/container metrics (Netdata).
- [ ] Backups scheduled + **offsite** + a **tested** `restore.sh` (today: co-located).
- [ ] Sentry active (SDK wired in Block 5 — set `SENTRY_DSN` in prod).
- [ ] Error budget policy + alerting thresholds → PagerDuty/Telegram.
