# WORKFLO.SPACE — Tracker (спрінти)

> Оновлено: **2 червня 2026** — перерозбито після фіналізації всіх 29 модулів (`SPEC.md`) + очистки беклогу.
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
> **Pre-S2 hardening (31.05) ✅:** критичний аудит S0-S1 виправлено + verified; dep-CVE оновлено (fastify/jwt/next); **tenant-enforcement `apps/api/src/auth/tenant.ts`** (`assertSameTenant` + loader'и `requireOrderParticipant`/`requireTeamOrder`) у кожному agency-scoped хендлері; композитні order-індекси готові. Деталі — `AUDIT_S0_S1.md` + ADR-004 amendment.
> **Аудит S0-S2 (1.06) ✅:** 5-агентний критичний рев'ю (security/types/db/quality/arch) — фундамент зрілий, критичних витоків нема; виправлено 6 (activity-leak, Decimal-серіалізація, platform-agency findUnique, invite-tx, orphan-blob, seed-гігієна); відкладене структуровано. Деталі — `AUDIT_S0_S2.md` + `BACKLOG.md`.

| ID    | Задача                                                                                                                                                                                                                                                                              | Модуль      | Статус |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| S2-01 | ✅ GET/POST /orders + 9-станова машина (`ALLOWED_ORDER_TRANSITIONS`/`canTransitionOrder`) + OrderStage (create) — tenant-scoped, 9 тестів                                                                                                                                           | [02-orders] | ✅ 🧪  |
| S2-02 | ✅ GET /orders/:id — detail + `assertSameTenant` + client-IDOR(404) + client/internal view + stages                                                                                                                                                                                 | [02-orders] | ✅ 🧪  |
| S2-03 | ✅ `PATCH /orders/:id/assign` — triage: призначення/зняття executor (валідація agency-member) + variant-B list-фільтр `assigneeId=none`                                                                                                                                             | [02-orders] | ✅ 🧪  |
| S2-04 | ✅ `PATCH /orders/:id/status` (state-machine) + `PATCH /orders/:id` (edit, role/status-gated) + `DELETE` (soft-delete) — internal↔client                                                                                                                                            | [02-orders] | ✅ 🧪  |
| S2-05 | ✅ CRUD internal tasks (`/orders/:orderId/tasks`, workspace-only, tenant+IDOR-guarded, member-validated assignee); onHold/cancelled reason set on transition (S2-04)                                                                                                                | [02-orders] | ✅ 🧪  |
| S2-06 | ✅ GET/POST /orders/:id/comments — cursor-пагінація + internal-leak guard (клієнт не бачить/не пише `isInternal`) + `requireOrderParticipant` IDOR-helper                                                                                                                           | [03-chat]   | ✅ 🧪  |
| S2-07 | ✅ GET /orders/:id/comments/stream (SSE) — DB-тригер `pg_notify('chat_events')` + shared LISTEN (1 конект/інстанс, reconnect-backoff) + in-memory `chatBus` fan-out + heartbeat + leak-guard; міграція verified на throwaway (NOTIFY-payload + `migrate diff` empty)                | [03-chat]   | ✅ 🧪  |
| S2-08 | ✅ `order_chat_reads` + POST /comments/read (upsert) + unread/lastReadAt у GET; participant IDOR predicate (shared `access.ts`)                                                                                                                                                     | [03-chat]   | ✅ 🧪  |
| S2-09 | ✅ packages/storage — `read()`+path-traversal guard (`safeResolve`), `sha256Hex`/`buildOrderFileKey`/`safeExt`, `0640`; OrderFile reconcile (agencyId/deletedAt/sha256, міграція verified throwaway, diff empty); MIME-allowlist (SVG прибрано) у @workflo/types; +8 storage-тестів | [04-files]  | ✅ 🧪  |
| S2-10 | ✅ POST `/orders/:id/files` (multipart, MIME 415, ліміт 100MB/413, 20-файлів/409, sha256, tenant-prefixed key) + GET list + DELETE (uploader/team, soft) — participant-guard                                                                                                        | [04-files]  | ✅ 🧪  |
| S2-11 | ✅ GET `/files/:id` (meta, storedAs не тече) + GET `/files/:id/content` (access-check, `Content-Disposition: attachment` + `nosniff`, traversal-guarded read)                                                                                                                       | [04-files]  | ✅ 🧪  |
| S2-12 | ✅ CRUD `/orders/:id/time-logs` (workspace-only, shared `requireTeamOrder`; create/list+total/edit/delete; author-only edit/delete; hours≤24/date-validation; Decimal→number, DATE→YYYY-MM-DD)                                                                                      | [12-team]   | ✅ 🧪  |
| S2-13 | ✅ Activity log + outbox notify: статус-перехід у `$transaction` (order.update + ActivityLog + `enqueueOutbox('order.status_changed')`) — атомарно; GET `/orders/:id/activity` (participant-scoped feed)                                                                            | [07]        | ✅ 🧪  |
| S2-14 | Deploy Sprint 2 → staging                                                                                                                                                                                                                                                           | Infra       | 🚀     |

---

## SAAS FOUNDATION (F1–F6) — структурний backfill у межах S2

> Повний план: [`SAAS.md`](SAAS.md). Принцип: структурне (схема/запити) закладаємо ЗАРАЗ (ретрофіт у живу мультитенантну БД дорогий); продуктове увімкнення (signup/біллінг/branding) — Phase 1 у кінці. «Перевести на SaaS наприкінці» безпечно лише якщо F1–F6 готові.

| ID    | Задача                                                                                                                                  | Модуль    | Статус         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------- |
| FDN-1 | SaaS-поля `Agency` (nullable міграція): subdomain/customDomain/plan/subscriptionStatus/trialEndsAt/billingCustomerId/suspendedAt/limits | [db]      | ✅             |
| FDN-2 | quota/feature **seam** `assertWithinQuota()`/`featureEnabled()` (no-op) у orders.create + **files.upload** (+ S5 invite)                | [adr/007] | ✅ (invite→S5) |
| FDN-3 | `provisionAgency()` — фабрика тенанта (Agency+owner+дефолтні налаштування); seed перевикористовує                                       | [db]      | ✅             |
| FDN-4 | RLS: Prisma-extension + політики (FORCE RLS + `workflo_app` роль) — **scaffold+verified, flag-gated** (`RLS_ENFORCED`)                  | [adr/007] | ✅ scaffold    |
| FDN-5 | `BASE_DOMAIN`+host-resolver stub ✅; tenant rate-limit key ⬜(ADR→Phase1); Traefik wildcard `*.workflo.space` ⬜(infra)                 | Infra     | 🔶 partial     |
| FDN-6 | (діє) кожна нова tenant-таблиця несе `agencyId` + RLS-політику з дня 1                                                                  | [all]     | ✅             |

> **🏗️ Foundation closure (2.06.2026) — структурні дірки S0–S3 закрито** (комміти `b3d5ea6`/`2b0ac97`/`a68be2d`/`b1c7f98`+):
>
> - **S-D2** per-agency `DocumentCounter`/`PaymentSettings`/`ExchangeRate` (крос-тенант нумерація інвойсів) · **S-D3** `agencyId` на `InternalTask`/`ActivityLog` · **S-D4** `order_chat_reads` FK CASCADE.
> - **R-1** executor-онбординг створює `AgencyMember` (був зламаний — locked-out) +тести · **R-3** Phase-1 IDOR у `requireTeamOrder` (→`order.agencyId`) · tenant-стемп audit/ActivityLog · outbox tenant-mismatch guard.
> - **F4 RLS** — політики (column + parent-join) + `FORCE RLS` + `workflo_app` роль + `$extends` tenant-context; **верифіковано на throwaway-pg** (ізоляція/bypass/permissive); активація — `ENGINEERING_STANDARDS → RLS rollout`.
> - **ADR-006** web/worker split (`worker.ts` + `RUN_WORKERS_INLINE` + opt-in compose `--profile workers`) · **R-4** SSE per-user cap.
> - **Лишилось (Tier-3, дешеве, isolated):** tenant-aware rate-limit key (ADR дозволяє Phase 1), Traefik wildcard (infra-doc), CI `migrate diff` drift-gate.

> **SaaS Enablement (Phase 1, у самому кінці — окремий пізній спрінт):** agency signup+onboarding, підписка агенції на workflo (Stripe/Paddle), per-domain branding у рантаймі, quota-значення (PLAN_LIMITS+UsageCounter), super-admin платформи, lifecycle тенанта (suspend/export/delete), AgencyFeatureFlag/ApiKey/WebhookEndpoint. Без міграції даних — поверх готової схеми.

---

## 🔁 Реордер (1.06.2026) — backend-first

> Рішення власника: **фронтенд (S3 Portal + S4 Workspace) робимо одним суцільним дизайн-проходом ПОТІМ** (коли всі API готові + дизайн звірений). Зараз — лише **design-independent бекенд**: outbox-drain → S5 (Billing/Wallet/Finance) → S6 (Documents/Notifications/Bot), пропускаючи їх UI-задачі (S5-11/12, S6-03, S6-07 — design-gated, у фронтенд-прохід).

| ID     | Задача                                                                                                                                                                       | Модуль | Статус |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| BE-OBX | ✅ Outbox-drain воркер (аудит T-D1): drain-loop у bootstrap + handler-registry + `order.status_changed`→notify (internal→client мапінг, пропуск не-клієнт-видимих); +4 тести | [07]   | ✅ 🧪  |

> **GROWTH (26/27) + SUPPORT (29)** — design-independent бекенд, паралелізовні; рекомендований слот: після S6-backend (або раніше за потребою). Tier-3 foundation-хвости (rate-limit key, Traefik wildcard, CI drift-gate) НЕ блокують S5/S6.

---

## 🌱 GROWTH — Ліди + Інтеграції (нові модулі 26/27, спец 1.06)

> Спеці: [`modules/26-leads.md`](modules/26-leads.md) + [`modules/27-integrations.md`](modules/27-integrations.md). API — design-independent (backend-фаза); екрани (канбан, settings/integrations) — у фронтенд-прохід. **Phase 1** = мінімум власника: форма клієнта + наші webhooks + Telegram-ліди.

| ID      | Задача                                                                                                                                                                | Модуль  | Статус    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- |
| LEAD-1  | `Lead`+`LeadPipeline`/`LeadStage`/`LeadActivity` міграція + дефолт-воронка в `provisionAgency()`                                                                      | [26]    | ⬜        |
| LEAD-2  | Leads API: CRUD + move-stage + assign + convert→Company + pipeline-config + SSE-дошка + notify `leads.new_lead`                                                       | [26]    | ⬜        |
| INT-1   | `ApiKey` (per-agency Bearer-auth-шлях + scopes) + **Inbound Lead API** `POST /v1/leads` (spam/rate/CORS/idempotency) → Lead(website_form)                             | [27]    | ⬜        |
| INT-2   | **Outbound webhooks**: `WebhookEndpoint`/`WebhookDelivery` + outbox handler `webhook.fanout`+`webhook.deliver` (HMAC `X-Workflo-Signature`); події order/payment/lead | [27]    | ⬜        |
| INT-3   | Telegram-адаптер як джерело лідів (бот уже є, 15) → Lead(telegram)                                                                                                    | [27/15] | ⬜        |
| INT-P2  | Meta (IG/FB Lead Ads + Messenger), WhatsApp, TikTok, embeddable-widget, inbound email→lead                                                                            | [27]    | ⬜ P2     |
| GROW-UI | Канбан лідів + `/settings/integrations` (ключі/webhooks/канали) — у фронтенд-прохід                                                                                   | [26/27] | ⏸️ design |

> **SaaS-вписування:** усе per-agency (ApiKey/WebhookEndpoint/IntegrationConnection/ліди) → конфіг у white-label-воркспейсі (`SAAS_CONFIG.md`); ліміти інтеграцій — через quota-seam (SAAS.md F2).

---

## 🎫 SUPPORT — Тікет-система (новий модуль 29, спец 1.06)

> Спец: [`modules/29-support.md`](modules/29-support.md). Закриває прогалину аудиту #2 (звернення поза замовленням). API — design-independent (backend-фаза); екрани (черга/тред) — у фронтенд-прохід, перевикористовують thread-патерн чату (03).

| ID     | Задача                                                                                                                                      | Модуль  | Статус    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- |
| SUP-1  | `Ticket`+`TicketMessage` міграція + `TicketStatus`/`TicketPriority` enums + категорії per-agency                                            | [29]    | ⬜        |
| SUP-2  | Portal API: відкрити/список/тред/відповісти (`/support/tickets`) + leak-guard (лише public) + notify `support.new_ticket`                   | [29]    | ⬜        |
| SUP-3  | Workspace API: черга+фільтри/тред(incl. internal)/відповідь/PATCH(status·priority·assign·category)/convert→Order + SSE (`chatBus`-патерн)   | [29]    | ⬜        |
| SUP-4  | Інтеграція в chat-hub (18): тікети поряд з order-чатами в єдиному inbox                                                                     | [29/18] | ⬜        |
| SUP-P2 | SLA-політики+breach-cron, auto-assign-правила, canned-replies, CSAT після close, email/telegram як source (через 27-inbound), KB-self-serve | [29]    | ⬜ P2     |
| SUP-UI | Portal (мої звернення/нове/тред) + Workspace (черга/тікет з internal-нотатками) — у фронтенд-прохід                                         | [29]    | ⏸️ design |

> **SaaS-вписування:** категорії/SLA per-agency; ліміти тікетів — через quota-seam (SAAS.md F2).

---

## SPRINT 3 — Portal Frontend (ядро) — ⏸️ ВІДКЛАДЕНО у фронтенд-прохід (design-gated)

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

| Фаза                           | Спрінти      | Статус    |
| ------------------------------ | ------------ | --------- |
| Foundation                     | S0, S1, S1.5 | ✅ done   |
| Tenancy + schema               | S1.6         | ✅ done   |
| Orders/Chat/Files backend      | S2           | ✅ done   |
| MVP ядро frontend              | S3-S4        | ⏸️ design |
| Billing/Wallet/Finance backend | S5           | ⬜ next   |
| MVP доки+контент               | S6-S7        | ⬜        |
| MVP launch v0.1.0              | S8           | ⬜        |
| Повний продукт (фічі)          | S9-S14       | ⬜        |

> **MVP-межа:** S8 (v0.1.0, перший клієнт). **Повноцінний продукт:** через S14.
> Деталі скоупу кожного модуля — `SPEC.md` + `modules/NN-*.md`.
