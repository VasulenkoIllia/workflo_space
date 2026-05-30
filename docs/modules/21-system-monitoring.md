# SYSTEM MONITORING MODULE

> App: API + Workspace
> Статус: S7-S8 (post-MVP, production hardening)
> Залежить від: Sentry SDK, audit_logs, cron_runs
> Оновлено: 27 травня 2026

---

## Огляд

Три шари моніторингу:

1. **Sentry** — exception capture з UI/API/cron.
2. **Internal dashboard** — `/workspace/admin/system` з metrics, cron status, alerts.
3. **Audit log** — every sensitive action (RBAC denials, credential reveals, ownership transfers).

---

## 1. Sentry integration

### Сервіси

- API: `@sentry/node` + Fastify plugin.
- Workspace / Portal / Landing: `@sentry/nextjs`.
- Bot: `@sentry/node`.
- Cron jobs: same as API (через shared init).

### Config (env)

- `SENTRY_DSN_API`
- `SENTRY_DSN_WORKSPACE`
- `SENTRY_DSN_PORTAL`
- `SENTRY_DSN_LANDING`
- `SENTRY_DSN_BOT`
- `SENTRY_ENVIRONMENT` (staging / production)
- `SENTRY_RELEASE` (commit SHA, injected by CI)
- `SENTRY_TRACES_SAMPLE_RATE` (0.1 prod, 1.0 staging)

### Конфігурація PII scrub

Перед відправкою event:

- Видаляємо `password`, `passwordHash`, `token`, `refresh_token`, `apiKey`, `authorization` headers.
- `req.body` через allowlist (тільки заплановані безпечні поля).
- IP scrub: anonymize last octet.
- User context: `{ id: userId }` (без email/name).

### Tagging

- `tag.module`: api | workspace | portal | landing | bot | cron
- `tag.cron_name`: 'C16:loyalty_recalc' (для cron errors)
- `tag.event`: NotificationEvent (для notify failures)

### Alert rules

- Error rate > 10/min for 5 min → PagerDuty.
- New error type → Slack #alerts.
- Performance: p95 API latency > 2s → Slack.

---

## 2. Internal dashboard

`/workspace/admin/system` — для owner/admin.

### Sections

**Health summary** (top cards):

- API uptime % (last 24h).
- Active users count (last 5min).
- DB connection pool usage.
- Pending cron jobs.
- Last deploy commit + timestamp.

**Cron status table** — re-uses `cron_runs` (див. модуль 20):

- Last 7 days × всі cron jobs.
- Cells coloured by status; click → drill-in з error message.

**Notification health**:

- `notify.dispatch.success_rate` (24h) per channel.
- `notify.telegram.blocked_total` (день/тижд).
- Failed delivery list (top 20) з retry button.

**Audit log feed**:

- Streaming feed `audit_logs` (latest 100).
- Filter by action prefix (`credentials.*`, `company.transfer_*`, `admin.*`).
- Click → modal з full metadata + actor profile.

**Error log**:

- Sentry top issues (через Sentry API; cached 1 min).
- Direct link to Sentry issue.

**DB metrics** (production-only):

- Top slow queries (pg_stat_statements top 10).
- Connection count.
- Cache hit ratio.

---

## 3. Audit log

Already covered у `RETENTION.md` + `LIFECYCLE.md`. Тут лише огляд що відстежуємо.

### Categories events

**Authentication**:

- `auth.login_success`
- `auth.login_failed` (з reason)
- `auth.refresh_used`
- `auth.password_changed`
- `auth.password_reset_requested`
- `auth.account_deactivated`

**Authorization (RBAC)**:

- `rbac.denied` (action, resource) — кожен `can() === false` що з backend
- `rbac.ownership_transferred`

**Sensitive actions**:

- `credentials.created` / `.updated` / `.revealed` / `.revoked` / `.deleted`
- `credentials.kek_rotated`
- `company.transfer_ownership`
- `company.deleted`
- `profile.deleted` (anonymize)

**Admin operations**:

- `admin.template_updated`
- `admin.smtp_sender_updated`
- `admin.branding_updated`
- `admin.nomenclature_changed`
- `admin.department_updated`
- `admin.cron_manual_triggered`
- `admin.user_deactivated`

**Financial**:

- `payment.confirmed` (з actor — manual vs auto)
- `payment.refunded`
- `invoice.cancelled`

### Storage

Таблиця `audit_logs` (див. schema у `06-documents.md` зі схемою з S1-03 migration).

### Retention

365 днів, cron C18 (`RETENTION.md`).

---

## 4. Heartbeat для cron

Кожен cron починає з:

```typescript
await prisma.cronRun.create({
  data: { cronName: 'C16:loyalty_recalc', startedAt: new Date(), status: 'running' },
})
```

Закінчує з:

```typescript
await prisma.cronRun.update({
  where: { id: runId },
  data: {
    endedAt: new Date(),
    status: success ? 'success' : 'failed',
    durationMs: Date.now() - startTs,
    errorMessage: error?.message,
  },
})
```

Detector cron (`C19:heartbeat_check`, every 30min):

- Перевіряє, що для кожного active cron job is a recent successful run.
- Якщо немає за > 2× expected interval → PagerDuty + Slack `#alerts`.

---

## 5. Performance metrics

### API (Fastify)

- p50 / p95 / p99 latency per route → exposed at `/metrics` (Prometheus format).
- Request count, error rate per status code.

### DB (PostgreSQL)

- Connection pool utilization.
- Long-running queries > 1s → log + Sentry breadcrumb.

### SSE

- Active streams count.
- Memory usage per stream.
- Average message rate.

### Notifications

- Dispatch latency per channel (email median 500ms, telegram 200ms typical).
- Rollup activation rate.

---

## 6. Deployment hook

GitHub Actions step:

- Run на successful deploy → POST до Sentry "new release" endpoint з commit SHA.
- Slack message `#deploys` з commit subject + author + URL.
- Trigger smoke tests (basic /health endpoint на всіх 5 apps).

---

## 7. SLA + Incident response

**SLA targets (MVP, internal):**

- API uptime: 99% / month.
- p95 latency: < 1s for read endpoints, < 2s for write.
- Email delivery success: > 95% per day.
- Telegram delivery: > 90% (excluding blocked users).

**Incident response**:

- **SEV1** (production down, > 50% users affected) → PagerDuty immediate, status page update, post-mortem within 48h.
- **SEV2** (partial outage, < 50%, e.g. Telegram blocked) → Slack ping, fix within 4h.
- **SEV3** (single user impact, edge case) → standard ticket, fix in next sprint.

Post-mortem template зберігається у `docs/POSTMORTEMS/` (створюємо per incident, gitignore'd ssh keys etc).

---

## 8. Logging

- Structured JSON logs via Pino.
- Centralized у Loki (S8+); for MVP — stdout + Docker log rotation (`max-size: 100m, max-file: 3`).
- Correlation ID: per-request via `X-Request-Id` header, propagated до DB queries (Prisma logger middleware).

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

- **`audit_logs.agencyId`** — feed tenant-scoped (agency-admin бачить свою агенцію; platform-superadmin — усі). `cron_runs.agencyId` (per-agency крони).
- Internal dashboard (`/workspace/admin/system`) — scope по agency; платформні метрики (DB pool, Sentry) лише superadmin.
- Notification-health/usage запити — з `agencyId`-фільтром (інакше cross-tenant).

### B. Per-agency usage metrics ✅

- `UsageCounter { agencyId, metric, period, value }` (orders, storage_bytes, api_calls, active_users) + rollup-cron. **Фундамент SaaS-білінгу (topic #8)** і лімітів тарифу. Дашборд «використання по агенції».

### C. Публічна status-page ✅

- `status.workflo.space` — uptime компонентів (api/portal/workspace/bot/email) + історія інцидентів. `StatusIncident { title, severity, status, startedAt, resolvedAt, updates[] }`. Живиться з health-checks + ручні incident-пости.

### D. SLO / error-budget ✅

- `SloTarget { service, metric, target, window }` + burn-rate алерти (замість простого порогу). Error-budget tracking; швидке вигоряння → PagerDuty.

### E. Моніторинг витрат інфри ✅

- Трекінг вартості серверів/API (Hetzner/Claude/SMTP) → **подається в модуль 22 (P&L) як автоматичні `infrastructure`-витрати**. Замикає коло дохід/витрати. `InfraCost { agencyId?, vendor, period, amountUsd }`.

```
Reconcile: audit_logs.agencyId, cron_runs.agencyId
New: UsageCounter, StatusIncident, SloTarget, InfraCost
```
