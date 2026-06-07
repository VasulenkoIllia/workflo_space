# REPORTS MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Workspace (owner-only)
> Статус: S4+ (post-MVP)
> Залежить від: `packages/db`, `02-orders`, `05-billing`, `12-team-executors`
> Оновлено: 27 травня 2026

---

## Огляд

Звіти для owner агенції. **3 канонічних звіти** у MVP-обсязі:

1. **Time report** — куди йдуть години (per executor / per company / per order).
2. **Revenue report** — оборот, прибуток, ARR.
3. **Debtors report** — хто має borg, скільки, як давно.

Кожен звіт = UI table + CSV export. PDF expor — у `BACKLOG.md`.

---

## 1. Time Report

**Питання owner'а:** "Куди реально йдуть години моєї команди за період X?"

### Endpoint

`GET /reports/time?from=2026-04-01&to=2026-04-30&groupBy=executor|company|order&executorId=&companyId=`

### Логіка

```sql
SELECT
  COALESCE(executor_id, company_id, order_id) AS bucket,
  SUM(duration_seconds) / 3600.0 AS total_hours,
  COUNT(*) AS sessions,
  -- billable hours: ті де order.billing_mode IN ('client_paid','internal_paid')
  SUM(CASE WHEN ... THEN duration_seconds ELSE 0 END) / 3600.0 AS billable_hours
FROM time_logs tl
JOIN orders o ON o.id = tl.order_id
WHERE tl.started_at BETWEEN $from AND $to
  AND tl.ended_at IS NOT NULL  -- exclude active timers
GROUP BY bucket
ORDER BY total_hours DESC;
```

### UI table

| Executor / Company / Order | Total hours | Billable | Non-billable | Sessions |
| -------------------------- | ----------: | -------: | -----------: | -------: |
| Olena Petrenko             |        42.5 |     38.0 |          4.5 |       18 |

CSV export: ті ж колонки + extra `period_start` / `period_end` headers.

---

## 2. Revenue Report

**Питання:** "Скільки реально заробляємо за період? Trend over time?"

### Endpoint

`GET /reports/revenue?from=&to=&granularity=day|week|month&currency=USD`

### Логіка

```sql
SELECT
  date_trunc('month', p.confirmed_at) AS period,
  SUM(p.amount_usd) AS revenue_usd,           -- усе зайшло
  SUM(CASE WHEN p.type='final' THEN p.amount_usd ELSE 0 END) AS final_revenue_usd,
  COUNT(DISTINCT p.company_id) AS paying_clients,
  COUNT(*) AS payments_count
FROM payments p
WHERE p.status = 'confirmed'
  AND p.confirmed_at BETWEEN $from AND $to
GROUP BY period
ORDER BY period;
```

Окремо рахуємо:

- Cost = сума ExecutorRate \* годин по orders за період.
- Profit = revenue − cost.
- Margin = profit / revenue.

### UI

- Line chart: revenue за period.
- Side stats: total revenue / total profit / margin% / paying clients.
- Table breakdown by month.

---

## 3. Debtors Report

**Питання:** "Хто винен? Скільки? Скільки днів прострочено?"

### Endpoint

`GET /reports/debtors?asOf=2026-05-01`

### Логіка

```sql
SELECT
  c.id AS company_id,
  c.name,
  SUM(sc.total_amount) AS total_owed_usd,
  MIN(sc.due_date) AS oldest_due,
  -- days overdue: as_of - oldest_due
  EXTRACT(day FROM $asOf::date - MIN(sc.due_date)::date)::INT AS days_overdue,
  COUNT(*) AS unpaid_invoices
FROM service_charges sc
JOIN companies c ON c.id = sc.company_id
WHERE sc.status IN ('pending', 'overdue')
  AND sc.due_date < $asOf
GROUP BY c.id, c.name
ORDER BY days_overdue DESC;
```

### UI table

| Company  | Total owed | Oldest due | Days overdue | Invoices |
| -------- | ---------: | ---------- | -----------: | -------: |
| Acme LLC |  $4,200.00 | 2026-03-15 |           47 |        3 |

Action buttons per row:

- "Send reminder" → `notify(event='billing.invoice_overdue', ...)`.
- "Mark write-off" (admin only) — закриває debt as bad debt.
- "View company" → drill-in.

### Aggregate KPIs (top of page)

- Total debt
- # debtors
- Avg days overdue
- Worst (top 5 with longest overdue)

---

## Загальні принципи

- **Owner-only** access (`can(user, 'admin.access')` або `memberships.role === 'owner'` на агенцію-головну компанію).
- **CSV export** для всіх звітів: `GET /reports/<name>.csv?...` (same query params).
- **Caching**: heavy queries cache 5 min per (params hash) у memory. Bust on payment confirmation, time log update.
- **Currency normalization**: всі суми в USD; exchange rate на дату payment з `exchange_rates` (для history accuracy).

---

## Performance

- Materialized view `revenue_monthly_mv` — refreshed nightly cron (С17).
- Index `payments(company_id, confirmed_at)` для debtor queries.
- Limit max time range: 12 months. Більше → manual chunk + повторний запит.

---

## UI Navigation

`/workspace/reports` — головна з 3 картками:

- "Time" → `/workspace/reports/time`
- "Revenue" → `/workspace/reports/revenue`
- "Debtors" → `/workspace/reports/debtors`

Кожна сторінка: filter bar зверху, results table/chart посередині, export button праворуч.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

**`agencyId`-фільтр у КОЖНОМУ запиті** (зараз cross-tenant витік аgrеgатів!); cache-key включає `agencyId`; **CSV formula-injection escape** (`=`/`+`/`-`/`@` leading); write-off/refund як cache-bust тригери; `revenue_monthly_mv` оголосити в міграції; `can()`-only (не raw `role==='owner'`) + tenant-guard; timezone-boundaries для from/to (agency-local); revenue-definition = wallet moneyBalance (один канон).

### B. Плановані звіти (email) ✅

- `ReportSchedule { id, agencyId, reportType, frequency, recipients[], format, nextRunAt }`. Cron генерує → надсилає через outbox (email з attachment). Напр. боржники щопонеділка.

### C. PDF/XLSX експорт ✅

- Окрім CSV: PDF (React-PDF, presentable) + XLSX (`exceljs`, для бухгалтера). Великі — async через outbox + лінк.

### D. Конструктор звітів ✅

- `ReportDefinition { id, agencyId, name, metrics[], groupBy, filters, createdBy }` — owner будує власні звіти понад 3 готові. Виконавчий движок over дозволених метрик (whitelist, не raw SQL). Phase 2.

```
New: ReportSchedule, ReportDefinition; revenue_monthly_mv (migration)
```

## Беклог-промоут (30.05) → у план

- **Retention-аналітика** (S11): дашборд утримання клієнтів — NEW→REGULAR conversion rate, P50 time-to-second-order, churn-сигнали. Будується на payments+loyalty-history (agency-scoped). Окрема картка поряд з time/revenue/debtors. Промоут із беклогу.
