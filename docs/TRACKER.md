# WORKFLO.SPACE — Tracker (спрінти)

> Оновлено: **30 травня 2026** — перерозбито після фіналізації всіх 25 модулів (`SPEC.md`) + очистки беклогу.
> Статуси: ⬜ pending | 🔄 in progress | ✅ done | 🧪 tested | 🚀 deployed | ❌ blocked
> `SPEC.md` = ЩО будуємо. Цей файл = У ЯКОМУ ПОРЯДКУ.

---

## Структура: MVP (S0-S8) → Повноцінний продукт (S9-S14)

- **S0-S8 — MVP v0.1.0:** ядро кожного модуля (reconcile A + CRUD + must-have) + перший живий клієнт.
- **S9-S14 — Enhancement:** обрані у вікторині фічі (B/C/D), що добудовують «повноцінний продукт». Заплановані, не беклог. Можна підтягувати раніше за потребою.
- Foundation (tenancy + schema-delta + outbox) — **S1.6, до S2**. Кожен модуль несе свій `agencyId`-reconcile у власному ядровому спрінті.

---

## ✅ ЗАВЕРШЕНО

| Спрінт     | Підсумок                                                                                             | Стан     |
| ---------- | ---------------------------------------------------------------------------------------------------- | -------- |
| **S0**     | Foundation: monorepo, CI, Hetzner, Traefik, DNS, schema+seed, health, helmet, TIMESTAMPTZ. 30 задач. | ✅ 🚀    |
| **S1**     | Auth+Core: register/login/logout/refresh/reset/me/guard, invites, profile, notify-matrix, i18n. 23.  | ✅ 🧪 🚀 |
| **S1.5-A** | Post-S1 audit fixes: security (logout/login/refresh/CSRF/invite) + migration safety.                 | ✅ 🧪    |
| **S1.5-B** | D1 `can()`-permissions + D2 `notifyRecipient()` + D5 enum-drift test.                                | ✅ 🧪    |
| **S1.5-C** | Schema hardening: Payment.status, ExecutorRate fields, FK indexes, onDelete, decimals.               | ✅ 🧪    |

> Повна історія завершених рядків — у git (`docs/TRACKER.md` до 30.05) + `modules/*` секції «Аудит-фіналізація».

---

## 🔍 Аудит закриття S0/S1 (30.05.2026)

**Зелене (перевірено локально):** `type-check` 19/19 ✅ · `lint` 13/13 ✅ · тести: api **69** ✅, notifications **64** ✅, types **23** ✅, i18n **8** ✅ · 6 міграцій (вкл. S1.5-C) · 5 Dockerfiles · compose dev/staging/production · CI (ci.yml PR + staging + production).

**S0 Foundation — закрито** (monorepo/CI/Hetzner/Traefik/DNS/schema/health — інфра+код зелені).
**S1 Auth — код закрито** (усі ендпойнти + 69 api-тестів зелені, staging deploy 🚀).

**Закрито (30.05):**

| ID  | Проблема                                                                                          | Дія                                            | Статус |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| C1  | `pnpm test` червоний: bot/landing/portal/workspace/ui мають `vitest run` без тест-файлів → exit 1 | `--passWithNoTests` у 5 апах                   | ✅     |
| C2  | Тести НЕ в CI (ci.yml/staging/production ганяють лише type-check+lint)                            | `turbo test` крок додано в усі 3 воркфлоу      | ✅     |
| C3  | **S1.5-D**: у деплої немає `prisma migrate deploy` (міграції руками)                              | окремий `migrate`-сервіс + run-крок (stg+prod) | ✅     |

> ✅ **S0+S1 повністю закриті (док+код):** `pnpm test` 15/15 green · тести в CI-гейті · міграції накочуються авто на деплої. Перевірка C3 на живому staging — поточний пуш. Далі S1.6.

---

## 🔑 SPRINT 1.6 — Tenancy + Foundation (ДО S2)

> Ціль: tenant-ready фундамент + надійна доставка + schema-delta + db-hardening. Розблоковує весь agencyId-reconcile.

| ID     | Задача                                                                                                                                 | Модуль    | Статус |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| S16-01 | ✅ `Agency` + `AgencyMember` + `AgencyMemberRole` + міграція (FK/indexes Prisma-naming)                                                | [adr/004] | ✅     |
| S16-02 | ✅ `agencyId` scoping (company req + orders/payments/docs/charges/comments/timelogs/services/rates/audit) + backfill + seed + register | [db]      | ✅     |
| S16-03 | ✅ JWT claims `activeAgencyId` + `agencyMemberships` (login/refresh/register); `/auth/switch-agency` → Фаза 1 (multi-agency, ADR-004)  | [01-auth] | ✅     |
| S16-04 | ✅ `can()` tenant-guard (default-deny крос-тенант) + 2 тести                                                                           | [adr/002] | ✅     |
| S16-05 | ✅ `OutboxEvent` + міграція + drain-сервіс (claim SKIP LOCKED + backoff + DLQ) + 5 тестів — handlers/cron у S6                         | [07]      | ✅     |
| S16-06 | ✅ Schema-delta batch-1: Order.{onHoldReason,cancelledReason} + OrderComment.{editedAt,deletedAt} + OrderChatRead (для S2 orders/chat) | [db]      | ✅     |
| S16-07 | ✅ db-hardening — вже виконано в S1.5-C (FK-індекси, Order.company onDelete:SetNull, Decimal(10,4); OtpToken-index чистий)             | [db]      | ✅     |
| S16-08 | ✅ telegramChatId dedup — прибрано unused Profile.telegram\* (NotificationSettings authoritative; verified no code reads)              | [15-bot]  | ✅     |
| S1.5-D | ✅ `prisma migrate deploy` на деплої (окремий `migrate`-сервіс, stg+prod)                                                              | Infra     | ✅     |

---

## SPRINT 2 — Orders + Chat + Files API (ядро)

> Ціль: повний CRUD замовлень, коментарі SSE, файли. reconcile (agencyId/IDOR/leak-guard) — у кожній задачі.
> **Pre-S2 hardening (31.05) ✅:** критичний аудит S0-S1 виправлено + verified; dep-CVE оновлено (fastify/jwt/next); **tenant-enforcement `apps/api/src/auth/tenant.ts` — ОБОВʼЯЗКОВО** (`tenantWhere`/`tenantData`/`assertSameTenant`) у кожному agency-scoped хендлері; композитні order-індекси готові. Деталі — `AUDIT_S0_S1.md` + ADR-004 amendment.

| ID    | Задача                                                                                                                                                               | Модуль      | Статус |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| S2-01 | ✅ GET/POST /orders + 9-станова машина (`ALLOWED_ORDER_TRANSITIONS`/`canTransitionOrder`) + OrderStage (create) — tenant-scoped, 9 тестів                            | [02-orders] | ✅ 🧪  |
| S2-02 | ✅ GET /orders/:id — detail + `assertSameTenant` + client-IDOR(404) + client/internal view + stages                                                                  | [02-orders] | ✅ 🧪  |
| S2-03 | ✅ `PATCH /orders/:id/assign` — triage: призначення/зняття executor (валідація agency-member) + variant-B list-фільтр `assigneeId=none`                              | [02-orders] | ✅ 🧪  |
| S2-04 | ✅ `PATCH /orders/:id/status` (state-machine) + `PATCH /orders/:id` (edit, role/status-gated) + `DELETE` (soft-delete) — internal↔client                             | [02-orders] | ✅ 🧪  |
| S2-05 | ✅ CRUD internal tasks (`/orders/:orderId/tasks`, workspace-only, tenant+IDOR-guarded, member-validated assignee); onHold/cancelled reason set on transition (S2-04) | [02-orders] | ✅ 🧪  |
| S2-06 | GET/POST /orders/:id/comments + internal-leak guard                                                                                                                  | [03-chat]   | ⬜     |
| S2-07 | GET /orders/:id/comments/stream (SSE, multi-instance pg_notify)                                                                                                      | [03-chat]   | ⬜     |
| S2-08 | order_chat_reads (unread) + participant IDOR predicate                                                                                                               | [03-chat]   | ⬜     |
| S2-09 | packages/storage — LocalStorageAdapter (tenant-prefixed, sha256)                                                                                                     | [04-files]  | ⬜     |
| S2-10 | POST/GET/DELETE /orders/:id/files + path-traversal guard                                                                                                             | [04-files]  | ⬜     |
| S2-11 | GET /files/serve/:key (authenticated, access-check)                                                                                                                  | [04-files]  | ⬜     |
| S2-12 | CRUD time logs (unified TimeLog)                                                                                                                                     | [12-team]   | ⬜     |
| S2-13 | Activity log + notify (status change → outbox)                                                                                                                       | [07]        | ⬜     |
| S2-14 | Deploy Sprint 2 → staging                                                                                                                                            | Infra       | 🚀     |

---

## SPRINT 3 — Portal Frontend (ядро)

> Ціль: клієнт реєструється, бачить задачі, спілкується, дивиться рахунки.

| ID    | Задача                                                          | Модуль      | Статус |
| ----- | --------------------------------------------------------------- | ----------- | ------ |
| S3-01 | packages/ui — Button/Input/Badge/Modal/Table/Avatar             | [UI]        | ⬜     |
| S3-02 | packages/ui — AuthLayout/DashboardLayout/ThemeProvider          | [UI]        | ⬜     |
| S3-03 | Portal — auth context + /login /register /forgot /reset /invite | [01]        | ⬜     |
| S3-04 | Portal — /dashboard + /tasks (список+фільтри)                   | [02-orders] | ⬜     |
| S3-05 | Portal — /tasks/new + /tasks/:id (статус+етапи)                 | [02-orders] | ⬜     |
| S3-06 | Portal — /tasks/:id чат (SSE) + файли + activity                | [03/04]     | ⬜     |
| S3-07 | Portal — /team (члени+invite)                                   | [01-auth]   | ⬜     |
| S3-08 | Portal — /settings (профіль/пароль/нотифікації/мова/тема)       | [13]        | ⬜     |
| S3-09 | i18n UA+EN + error-toasts + mobile responsive                   | [UI]        | ⬜     |
| S3-10 | Deploy Sprint 3 → staging                                       | Infra       | 🚀     |

---

## SPRINT 4 — Workspace Frontend (ядро)

> Ціль: owner і executor повноцінно працюють.

| ID    | Задача                                             | Модуль      | Статус |
| ----- | -------------------------------------------------- | ----------- | ------ |
| S4-01 | Workspace — auth + /login + /invite (executor)     | [01-auth]   | ⬜     |
| S4-02 | Executor — kanban своїх задач + /tasks/:id + time  | [02/12]     | ⬜     |
| S4-03 | Executor — /profile заробіток                      | [12-team]   | ⬜     |
| S4-04 | Owner — overview dashboard                         | [02-orders] | ⬜     |
| S4-05 | Owner — /orders kanban+таблиця+пошук + /orders/:id | [02]        | ⬜     |
| S4-06 | Owner — /clients список + /clients/:id картка      | [02-orders] | ⬜     |
| S4-07 | IP-whitelist middleware (workspace) + i18n         | Infra       | ⬜     |
| S4-08 | Deploy Sprint 4 → staging                          | Infra       | 🚀     |

---

## SPRINT 5 — Billing + Wallet + Finance + Team (ядро фінансів)

> Ціль: рахунки, платежі, гаманець (2 рахунки), P&L, команда, реферали, лояльність.

| ID    | Задача                                                                          | Модуль        | Статус |
| ----- | ------------------------------------------------------------------------------- | ------------- | ------ |
| S5-01 | packages/payments — PaymentProvider interface + ManualProvider + race-guard     | [05-billing]  | ⬜     |
| S5-02 | API — /billing/summary /charges + POST payments + advance + idempotency         | [05-billing]  | ⬜     |
| S5-03 | ExchangeRate НБУ cron + Services CRUD + recurring charges cron (CompanyService) | [05-billing]  | ⬜     |
| S5-04 | API — Team rates/earnings + ExecutorPayout + company members+permissions        | [12-team]     | ⬜     |
| S5-05 | Wallet — WalletTransaction ledger + walletCredit/Debit (інваріант, FOR UPDATE)  | [25-wallet]   | ⬜     |
| S5-06 | Wallet — referral accrual→credit + ReferralSettings (редаговані %)              | [25/09]       | ⬜     |
| S5-07 | Wallet — money-account: PaymentAllocation + moneyBalance + стани                | [25-wallet]   | ⬜     |
| S5-08 | Wallet — unified statement + spending (bonus/prepaid на invoice)                | [25-wallet]   | ⬜     |
| S5-09 | Loyalty — tier-recalc cron + discount-apply + LoyaltyTierHistory                | [10-loyalty]  | ⬜     |
| S5-10 | Finance — Expense model + CRUD + P&L (revenue−expenses, ЗП з ExecutorRate)      | [22-finance]  | ⬜     |
| S5-11 | Portal — /billing /wallet /referrals /loyalty                                   | [05/25/09/10] | ⬜     |
| S5-12 | Workspace — /billing /payouts /services /team /finance /admin-wallet            | [05/12/22/25] | ⬜     |
| S5-13 | Deploy Sprint 5 → staging                                                       | Infra         | 🚀     |

---

## SPRINT 6 — Documents + Notification-channels + Bot (ядро)

| ID    | Задача                                                             | Модуль         | Статус |
| ----- | ------------------------------------------------------------------ | -------------- | ------ |
| S6-01 | packages/templates — Invoice/Act/Specification PDF                 | [06-documents] | ⬜     |
| S6-02 | API — documents create/download/send + per-agency numbering (race) | [06-documents] | ⬜     |
| S6-03 | Documents UI — Portal+Workspace вкладка                            | [06-documents] | ⬜     |
| S6-04 | Notifications — in-app center API (list/read) GET/PATCH            | [07]           | ⬜     |
| S6-05 | Bot — /start + OTP flow + webhook mode + update-id dedup           | [15-bot]       | ⬜     |
| S6-06 | Bot — notification events handler + /profile/telegram/connect      | [15/13]        | ⬜     |
| S6-07 | Email templates HTML design (всі транзакційні)                     | [08-email]     | ⬜     |
| S6-08 | Deploy Sprint 6 → staging                                          | Infra          | 🚀     |

---

## SPRINT 7 — Landing + Blog + Chat-hub (ядро)

| ID    | Задача                                                              | Модуль        | Статус |
| ----- | ------------------------------------------------------------------- | ------------- | ------ |
| S7-01 | Landing — Hero/проблеми/кейси/команда/стек/FAQ/CTA                  | [14-landing]  | ⬜     |
| S7-02 | Landing — /blog /cases ISR + реальна BlogPost схема                 | [11-content]  | ⬜     |
| S7-03 | Landing — UA+EN + SEO(metadata/sitemap/hreflang/OG) + Lighthouse≥90 | [14]          | ⬜     |
| S7-04 | Landing — contact form → /api/contact (Turnstile/honeypot)          | [14-landing]  | ⬜     |
| S7-05 | API — AI content generation (quota/sanitize) + Workspace /content   | [11]          | ⬜     |
| S7-06 | Workspace — /messages + /inbox (chat-hub ядро)                      | [18-chat-hub] | ⬜     |
| S7-07 | Deploy Sprint 7 → staging                                           | Infra         | 🚀     |

---

## SPRINT 8 — QA + Launch (MVP v0.1.0)

| ID    | Задача                                                              | Модуль | Статус |
| ----- | ------------------------------------------------------------------- | ------ | ------ |
| S8-01 | Integration tests — auth/orders/billing/referral                    | All    | ⬜     |
| S8-02 | Security review — OWASP checklist + tenant-isolation                | Infra  | ⬜     |
| S8-03 | Sentry (5 apps) + UptimeRobot + Netdata + backup-cron               | Infra  | ⬜     |
| S8-04 | pg_cron перевірка (recurring/НБУ/loyalty/heartbeat)                 | Infra  | ⬜     |
| S8-05 | Перший реальний клієнт — ручне тестування + багфікс                 | All    | ⬜     |
| S8-06 | Migration smoke-test (накат усіх міграцій на чистий PG + seed) у CI | Infra  | ⬜     |
| S8-07 | On-call runbook (що робити коли SMTP/Telegram/DB лягло)             | Infra  | ⬜     |
| S8-08 | git tag v0.1.0 + 🚀 Production deploy                               | Infra  | ⬜     |

---

# 🚀 ПОВНОЦІННИЙ ПРОДУКТ (S9-S14) — обрані фічі

> Добудовуємо після живого MVP. Кожен спрінт — тематична група фіч з вікторини. Порядок гнучкий.

## SPRINT 9 — Auth & Security (повний)

| ID    | Задача                                                                  | Модуль           | Статус |
| ----- | ----------------------------------------------------------------------- | ---------------- | ------ |
| S9-01 | 2FA TOTP (totpSecretEnc/backupCodes) + 2-step login challenge           | [01-auth]        | ⬜     |
| S9-02 | Active sessions UI (refresh metadata) + reuse-detection + revoke        | [01-auth]        | ⬜     |
| S9-03 | Google OAuth (OAuthAccount) + email-verify flow                         | [01-auth]        | ⬜     |
| S9-04 | Credentials vault — envelope crypto + reveal/revoke/delete + rate-limit | [17-credentials] | ⬜     |
| S9-05 | Credentials — 2FA-на-reveal + CredentialShare (scoped) + rotation-cron  | [17-credentials] | ⬜     |
| S9-06 | GDPR data-export + Profile.timezone/phone                               | [13-settings]    | ⬜     |
| S9-07 | Темна тема в Portal (підключити ThemeProvider + перемикач) ⬅backlog     | [13-settings]    | ⬜     |

## SPRINT 10 — Orders & Chat (повний)

| ID     | Задача                                                                    | Модуль      | Статус |
| ------ | ------------------------------------------------------------------------- | ----------- | ------ |
| S10-01 | OrderTag/Assignment + OrderTemplate                                       | [02-orders] | ⬜     |
| S10-02 | SlaPolicy + breach-cron + escalation                                      | [02-orders] | ⬜     |
| S10-03 | OrderDependency (cycle-guard) + gantt-view                                | [02-orders] | ⬜     |
| S10-04 | Chat — edit/delete (15-min) + CommentReaction + replyToId + read-receipts | [03-chat]   | ⬜     |
| S10-05 | Chat-hub — mute/archive (ConversationState) + filters + @-mention picker  | [18/03]     | ⬜     |
| S10-06 | Files — sharp thumbnails (?variant) + S3StorageAdapter (R2)               | [04-files]  | ⬜     |
| S10-07 | Orders — soft-delete restore UI (admin, 30д вікно) + /restore ⬅backlog    | [02-orders] | ⬜     |

## SPRINT 11 — Search + Reports + Admin (повний)

| ID     | Задача                                                                                    | Модуль       | Статус |
| ------ | ----------------------------------------------------------------------------------------- | ------------ | ------ |
| S11-01 | Search — Postgres FTS (agency-scoped GIN) + SearchAdapter                                 | [16-search]  | ⬜     |
| S11-02 | Search — Cmd+K command palette (+ Meilisearch adapter stub)                               | [16-search]  | ⬜     |
| S11-03 | Reports — scheduled email (ReportSchedule+cron) + PDF/XLSX                                | [19-reports] | ⬜     |
| S11-04 | Reports — custom ReportDefinition builder + revenue_monthly_mv                            | [19-reports] | ⬜     |
| S11-05 | Admin — templates/SMTP/branding/nomenclature/departments editor (per-agency)              | [20-admin]   | ⬜     |
| S11-06 | Admin — AgencyFeatureFlag + outbound webhooks + ApiKey + config export                    | [20-admin]   | ⬜     |
| S11-07 | Retention-аналітика дашборд (NEW→REGULAR/time-to-2nd/churn) + Public API Swagger ⬅backlog | [19/20]      | ⬜     |

## SPRINT 12 — Documents & Notifications (повний)

| ID     | Задача                                                                                | Модуль   | Статус |
| ------ | ------------------------------------------------------------------------------------- | -------- | ------ |
| S12-01 | e-signature (click→accept; SignatureProvider for Diia/КЕП)                            | [06-doc] | ⬜     |
| S12-02 | DocumentTemplate + bulk-generate (outbox) + draft→preview→approve                     | [06]     | ⬜     |
| S12-03 | Web Push (PushSubscription+VAPID+PushAdapter)                                         | [07]     | ⬜     |
| S12-04 | SMS adapter (SmsAdapter TurboSMS/Twilio, per-agency)                                  | [07]     | ⬜     |
| S12-05 | Email inbound→task + bounce/suppression + unsubscribe + DKIM domain                   | [08]     | ⬜     |
| S12-06 | Quiet-hours / digest (NotificationPreference.{quietFrom,quietTo,digestMode}) ⬅backlog | [07]     | ⬜     |
| S12-07 | Bulk-розсилки (BulkBroadcast + outbox worker, сегментація) ⬅backlog                   | [07]     | ⬜     |

## SPRINT 13 — Calendar + Leave + Finance Phase 2

| ID     | Задача                                                                                 | Модуль     | Статус |
| ------ | -------------------------------------------------------------------------------------- | ---------- | ------ |
| S13-01 | Calendar — CalendarEvent/Attendee + per-event tz + aggregated view                     | [24]       | ⬜     |
| S13-02 | Calendar — reminder-cron + notifyRecipient guests                                      | [24]       | ⬜     |
| S13-03 | Calendar — booking-links (Calendly) + MeetingProvider (auto-video)                     | [24]       | ⬜     |
| S13-04 | Leave — LeaveRequest + approve/reject + self-vs-others can()                           | [23-leave] | ⬜     |
| S13-05 | Leave — LeaveBalance accrual (hireDate) + calendar-integration                         | [23-leave] | ⬜     |
| S13-06 | Finance Phase 2 — cost allocation (margin по клієнтах) + receipts/budgets/approval/VAT | [22]       | ⬜     |

## SPRINT 14 — Ops + SaaS-readiness + контент-фічі

| ID     | Задача                                                                                           | Модуль       | Статус |
| ------ | ------------------------------------------------------------------------------------------------ | ------------ | ------ |
| S14-01 | Monitoring — per-agency UsageCounter + dashboard (SaaS-ready)                                    | [21-monitor] | ⬜     |
| S14-02 | Monitoring — public status-page + SLO/error-budget + InfraCost→P&L                               | [21]         | ⬜     |
| S14-03 | Payments go-live — Monobank/Stripe provider + webhooks(outbox) + DunningPolicy + PaymentSchedule | [05]         | ⬜     |
| S14-04 | Landing — CMS (LandingContent) + cookie-consent + live-chat                                      | [14-landing] | ⬜     |
| S14-05 | Referral gamification (ReferralAchievement/leaderboard) + executor KPI dashboard                 | [09/12]      | ⬜     |
| S14-06 | Content — реальні SEO-поля + (BACKLOG: scheduled publishing)                                     | [11-content] | ⬜     |

---

## ПРОГРЕС

| Фаза                     | Спрінти      | Статус  |
| ------------------------ | ------------ | ------- |
| Foundation               | S0, S1, S1.5 | ✅ done |
| Tenancy + schema         | S1.6         | ⬜ next |
| MVP ядро (API+frontend)  | S2-S4        | ⬜      |
| MVP фінанси+доки+контент | S5-S7        | ⬜      |
| MVP launch v0.1.0        | S8           | ⬜      |
| Повний продукт (фічі)    | S9-S14       | ⬜      |

> **MVP-межа:** S8 (v0.1.0, перший клієнт). **Повноцінний продукт:** через S14.
> Деталі скоупу кожного модуля — `SPEC.md` + `modules/NN-*.md`.
