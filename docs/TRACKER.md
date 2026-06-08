# WORKFLO.SPACE — Tracker (спрінти)

> Оновлено: **7 червня 2026** (аудит + ремедіація).
> Статуси: ⬜ pending | 🔄 in progress | ✅ done | 🧪 tested | 🚀 deployed | ❌ blocked
> `SPEC.md` = ЩО будуємо. Цей файл = У ЯКОМУ ПОРЯДКУ. Канон БД — `schema.prisma`; код — git.

---

## 🧭 СТАН ЗАРАЗ (7 червня 2026)

**✅ ГОТОВО (закодовано + verified, гілка `dev`):**

- **S0** Foundation (monorepo/CI/Hetzner/Traefik/DNS/schema+seed/health) 🚀
- **S1 + S1.5** Auth+Core (register/login/logout/refresh+rotation/reset/me/invites/profile) + hardening 🚀🧪
- **S1.6** Tenancy (Agency/AgencyMember, `agencyId` скрізь) + Outbox+drain + web/worker split 🧪
- **S2** Orders+Chat+Files API (CRUD, 9-станова машина, SSE-чат, файли, time-logs, activity) 🧪
- **S3** Portal frontend: auth-екрани, /orders (список+деталь+SSE-чат+файли+activity), /settings, /team, /invite + дизайн-система `@workflo/ui` 🧪
- **Аудит-ремедіація (11 комітів, 2026-06-07):** read+write RLS через `withTenant`/`tenantTransaction` + **тест крос-тенантної ізоляції** (CI-гейт `db-integration`) · `/auth/switch-agency` (multi-agency) · схема-hardening (ExecutorRate-історія, ідемпотентність Payment/ReferralBonus, `agencyId` NOT NULL на tenant-таблицях, `UsageCounter`+`AgencyFeatureFlag`) · Sentry (guarded) + CI migrate-diff drift-gate · спільний CORS/CSRF allowlist · magic-bytes на завантаженні · runtime-branding seam (ThemeProvider token-map + `GET /tenant/branding`) · exec-доки (ERD/PRICING/SLA/SECURITY/LEGAL) · узгодження документації.

**🔜 ДАЛІ (рекомендований порядок для соло-фази «продукт для себе»):**

1. **Ручне тестування готового** (S2 API + S3 Portal + S4 Workspace) — поточний крок власника.
2. **S4 Workspace frontend** 🔄 — S4-01…S4-06 закодовано (`apps/workspace`, дзеркало Portal: role-based shell, executor-kanban+order-detail+time, owner dashboard/orders/clients). Лишилось S4-07 (IP-whitelist Traefik + i18n) → S4-08 deploy. Бек-гейти (заробіток/assign/rich-clients) чекають S5.
3. **S5 Billing+Wallet+Finance+Team** (фінансове ядро; ship **test-first** + idempotency-first — `WalletTransaction`/`PaymentAllocation`/`Expense`). Розблоковує бек-гейти S4-03/05/06.
4. **S6 Documents+Notifications+Bot**, **S7 Landing+Blog+ChatHub**, **S8 QA+launch v0.1.0**.

**⏸️ ВІДКЛАДЕНО СВІДОМО (не для соло-фази):**

- **SaaS-Enablement** (signup/підписка/super-admin/quota-значення/custom-домени/runtime-fetch брендингу) — окремий пізній спринт, коли вирішиш продавати. Фундамент (F1–F6) готовий; це додавання поверх, без міграції даних.
- **Block 7b:** i18n-світ ~21 portal-файлу (UA→`t()`, en-локаль) + self-host шрифтів (GDPR). Seam готовий; робота механічна.
- **RLS-активація** (workflo_app LOGIN + `DATABASE_APP_URL` + `RLS_ENFORCED=true` + soak) — перед першим зовнішнім тенантом, не зараз.
- **Дисципліна по дорозі** (щоб «SaaS в кінці» лишався дешевим): кожна нова таблиця з `agencyId`; кожен запит scoped; UI на токенах `--wf-*`; `t()` на нових екранах.

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
> **Pre-S2 hardening (31.05) ✅:** критичний аудит S0-S1 виправлено + verified; dep-CVE оновлено (fastify/jwt/next); **tenant-enforcement `apps/api/src/auth/tenant.ts`** (`assertSameTenant` + loader'и `requireOrderParticipant`/`requireTeamOrder`) у кожному agency-scoped хендлері; композитні order-індекси готові. Деталі — `archive/AUDIT_S0_S1.md` + ADR-004 amendment.
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

| ID    | Задача                                                                                                                                    | Модуль    | Статус         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------- |
| FDN-1 | SaaS-поля `Agency` (nullable міграція): subdomain/customDomain/plan/subscriptionStatus/trialEndsAt/billingCustomerId/suspendedAt/limits   | [db]      | ✅             |
| FDN-2 | quota/feature **seam** `assertWithinQuota()`/`featureEnabled()` (no-op) у orders.create + **files.upload** (+ S5 invite)                  | [adr/007] | ✅ (invite→S5) |
| FDN-3 | `provisionAgency()` — фабрика тенанта (Agency+owner+дефолтні налаштування); seed перевикористовує                                         | [db]      | ✅             |
| FDN-4 | RLS: `tenantTransaction` (interactive-tx GUC) + політики (FORCE RLS + `workflo_app` роль) — **verified e2e, flag-gated** (`RLS_ENFORCED`) | [adr/007] | ✅ scaffold    |
| FDN-5 | `BASE_DOMAIN`+host-resolver stub ✅; tenant rate-limit key ⬜(ADR→Phase1); Traefik wildcard `*.workflo.space` ⬜(infra)                   | Infra     | 🔶 partial     |
| FDN-6 | (діє) кожна нова tenant-таблиця несе `agencyId` + RLS-політику з дня 1                                                                    | [all]     | ✅             |

> **🏗️ Foundation closure (2.06.2026) — структурні дірки S0–S3 закрито** (комміти `b3d5ea6`/`2b0ac97`/`a68be2d`/`b1c7f98`+):
>
> - **S-D2** per-agency `DocumentCounter`/`PaymentSettings`/`ExchangeRate` (крос-тенант нумерація інвойсів) · **S-D3** `agencyId` на `InternalTask`/`ActivityLog` · **S-D4** `order_chat_reads` FK CASCADE.
> - **R-1** executor-онбординг створює `AgencyMember` (був зламаний — locked-out) +тести · **R-3** Phase-1 IDOR у `requireTeamOrder` (→`order.agencyId`) · tenant-стемп audit/ActivityLog · outbox tenant-mismatch guard.
> - **F4 RLS** — політики (column + parent-join) + `FORCE RLS` + `workflo_app` роль + **`tenantTransaction`** (interactive-tx GUC; per-op `$extends` відхилено — нуль ізоляції); **верифіковано e2e на throwaway-pg як `workflo_app`**; активація — `ENGINEERING_STANDARDS → RLS rollout`.
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

## SPRINT 3 — Portal Frontend (ядро) — 🔄 У РОБОТІ (design-system-first)

> Ціль: клієнт реєструється, бачить задачі, спілкується, дивиться рахунки.
> **Підхід (рішення власника 2026-06-04): design-system-first** — спершу ядро `@workflo/ui` (компонент → Storybook-дока → reuse), потім екрани. Деталі — [`UI_COMPONENTS.md`](UI_COMPONENTS.md). Естетика «Engineer's Cut» портована з `design/` (токени `--wf-*` + класи `.wfp-*`, verbatim CSS). Фаза A=фундамент+flagship, B=решта ядра+shell, C=екрани Portal.

| ID     | Задача                                                                                                         | Модуль      | Статус |
| ------ | -------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| S3-01  | packages/ui примітиви — Button/Input/Badge/StatusDot/Card/EmptyState/Skeleton/Avatar/Modal (+Storybook+тести)  | [UI]        | ✅ 🧪  |
| S3-02  | packages/ui shell — AppShell(термінал-chrome)/Sidebar/Topbar/AuthShell/Icon + ThemeProvider(theme+6 accent)    | [UI]        | ✅ 🧪  |
| S3-03  | Portal wiring — api-client(Bearer+401-refresh)/queryClient/SSE/AuthContext/ProtectedRoute/router/i18n + /login | [01]        | ✅ 🧪  |
| S3-03b | Portal auth — /register(2-step+strength) /forgot(sent+timer) /reset(token+strength); /invite ⬜                | [01]        | ✅ 🧪  |
| S3-04  | Portal — /orders (список+фільтри+пошук+stats+empty/loading/error; React Query); E2E-з-даними ⏳                | [02-orders] | ✅     |
| S3-05  | Portal — /orders/:id (header+статус+етапи, sidebar Фінанси/Деталі, approval-banner, skeleton/404)              | [02-orders] | ✅     |
| S3-06  | Portal — /orders/:id чат (live-SSE+send+read) + файли (upload/download/delete) + activity                      | [03/04]     | ✅     |
| S3-07  | Portal — /team (invite учасника; members-list → S5, нема API) + /invite/:token accept                          | [01-auth]   | ✅     |
| S3-08  | Portal — /settings (профіль / вигляд: тема+мова / зміна пароля; notif-matrix → відкладено)                     | [13]        | ✅     |
| S3-09  | i18n UA+EN + error-toasts (✅ каркас) + mobile responsive (⬜)                                                 | [UI]        | 🔄     |
| S3-10  | Deploy Sprint 3 → staging                                                                                      | Infra       | 🚀     |

> **Table** примітив — відкладено до екранів, що його потребують (S10). **Tabs** ✅ — примітив на дизайн-класах `.wfp-od-tab*` (C4 prereq, +story+тест). **Toast** = Sonner. **Аудит C1 (2026-06-04):** 2-агентний рев'ю (code+TS), виправлено SSE-401-loop, Modal scroll-lock/close, StrictMode-refresh, Icon literal-типи, api JSON-parse guard, i18n memo. **Аудит C2/C3 (2026-06-04):** ResetPassword→zodResolver (помилки під правильними полями + server-error окремо), orders `status=all` URL-guard, RegisterForm=`z.infer` (anti-drift) + Enter-guard на кроці-0, `internalStatusesFor` без касту, `counts` тип, a11y Space-клавіша, прибрано dead-code. **Аудит C4 (2026-06-04):** lifted SSE на рівень сторінки (не губимо апдейти поза чат-табом), query `enabled`-guard, SSE shape-guard (захист від кривого payload), download revoke-race fix, near-bottom autoscroll, upload error-state. Декомпозиція (`lib/orderDetail` + `ChatTab` + `FilesTab` + page) — здорова. **Аудит C5/комплексний (2026-06-04):** 3 агенти (code+TS+security). react-router CVE (open-redirect)→6.30.4 + `safeRedirect`-guard; RegisterPage шанує `from` (invite→register→accept); SettingsPage split-мутацій (без toast/reload-спаму на клік теми); `suppressGlobalToast`-meta (без подвійних тостів invite/password); password max-length+strength-meter+inline-error; accept reload-fail. **Security:** access-token лише в памʼяті (без localStorage/URL); без XSS (React-escape, 0 dangerouslySetInnerHTML); forced-download; CSRF-safe (Bearer). `InviteStatus` enum↔API ('accepted'/'used') — окремий backend-таск. Декомпозиція — здорова всі рази.

> **Відповідність код↔дизайн↔доки (S3, 2026-06-04):** екрани кодовано 1:1 на `.wfp-*` дизайн-класах. Свідомі розбіжності (бекенд/скоуп, НЕ дефекти): login phone-OTP+2FA (S9); register extra-поля тип/ЄДРПОУ/slug/currency (нема в S2-register); orders pay-status badge + «до оплати $» (нема в list-DTO/aggregate); order approval-banner = informational (client-approve не в S2); Документи-таб = empty (S6); /team members-list (S5); /settings notif-matrix (відкладено) + theme/lang read-on-login (gap); mobile-responsive (окремі design-mobile екрани — відкладено). Dashboard у Portal-дизайні відсутній (/→/orders).

---

## SPRINT 4 — Workspace Frontend (ядро) — 🔄 У РОБОТІ (design-system-first)

> Ціль: owner і executor повноцінно працюють.
> **Підхід:** дзеркало S3 (`apps/portal`) — той самий wiring (`api`/`sse`/`queryClient`/`AuthContext`/i18n), `@workflo/ui` shell (`AppShell kind="workspace"`), екрани 1:1 на `.wfp-*` дизайн-класах. Єдина апка з **role-based** nav+routing (owner ↔ executor); клієнтів у Workspace не пускає `ProtectedRoute` (`isInternal`).

| ID     | Задача                                                                                                                                 | Модуль      | Статус |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| S4-01  | Workspace — auth (/login /forgot /reset) + /invite (executor) + owner /team-invite + фундамент (role-shell, ProtectedRoute, RoleRoute) | [01-auth]   | ✅     |
| S4-02  | Executor — kanban своїх задач (`/`) + /orders/:id (internal: Чат+internal-toggle / Файли / Час) + time-logs CRUD                       | [02/12]     | ✅     |
| S4-03  | Executor — /profile (обліковий запис; заробіток-секція ⏸️ S5 — ставки/виплати)                                                         | [12-team]   | ✅ 🟡  |
| S4-04  | Owner — overview dashboard (stats + attention items + all-orders board)                                                                | [02-orders] | ✅     |
| S4-05  | Owner — /orders (board+таблиця+пошук) + /orders/:id (status-transition; assign ⏸️ потребує members-API S5)                             | [02]        | ✅     |
| S4-06  | Owner — /clients (derived з orders за companyId) + /clients/:id (orders+назва з деталі) — rich-профілі ⏸️ S5/28                        | [02-orders] | ✅ 🟡  |
| S4-07a | IP-whitelist (workspace) — Traefik `ipwhitelist` middleware `sourcerange=${TEAM_IPS}` на обох compose (stg+prod)                       | Infra       | ✅ 🟢  |
| S4-07b | i18n `t()`-світ workspace-екранів (Block 7b, UA→ключі)                                                                                 | Infra       | ⬜     |
| S4-08  | Deploy Sprint 4 → staging (CI вже білдить+пушить+деплоїть `workspace`; треба заповнити `TEAM_IPS`+secrets)                             | Infra       | 🚀     |

> **Прогрес (2026-06-07):** S4-01…S4-06 закодовано в `apps/workspace` (дзеркало `apps/portal`). **Свідомі бек-гейти (НЕ дефекти):** заробіток виконавця (S4-03) + assign-виконавця (S4-05) + rich client-профілі/назви (S4-06) чекають S5-API (ExecutorRate/earnings · members-list · clients-модуль 28). Самостійна реєстрація запрошеного виконавця без акаунта — окремий auth-таск.
>
> **🔎 Аудит S4 + ремедіація (2026-06-08):** 3-агентний аудит (code · TypeScript · design-conformance/coverage/decomposition). **Регресій 0** (лише нові `apps/workspace`-файли + additive infra; спільні пакети не чіпані). **Декомпозиція здорова** (файли ≤282 рядків, делегують у sub-компоненти/хуки — легші за portal-аналоги; split не потрібен). **Дизайн-відповідність ~95%** (75/76 `.wfp-*` класів валідні; `.wfp-field-hint--error` існує в `components.css`). Виправлено 10 пунктів: SSE-guard `isChatComment` (+isInternal/+createdAt) · InviteAccept відхиляє non-executor (інакше CompanyMember→lockout) · a11y-клавіатура на рядках таблиць ×3 · `useTransitionStatus` generic→`Pick` · явний cast статусу · тайтенінг DTO-типів (clientStatus/type/billingType→enum, StageStatus) · compile-time exhaustiveness `STATUS_COLUMN` · OwnerDashboard total з пагінації · `RoleRoute` loading-guard · `api.ts ?? → \|\|`. **Інфра-фікс (критичний для прода):** SPA звертались до `/api` (відносний) без проксі, а API на окремому піддомені → `VITE_API_URL` тепер бейкається на білді (`ARG` у Dockerfile portal+workspace + `build-args` у CI stg/prod). Гейт після правок зелений (21/21 · 13/13 · 18/18). План тестування + серверний чек-лист — `docs/S4_TEST_PLAN.md`.

---

## SPRINT 5 — Billing + Wallet + Finance + Team (ядро фінансів) — 🔄 У РОБОТІ (backend-first, test-first)

> Ціль: рахунки, платежі, гаманець (2 рахунки), P&L, команда, реферали, лояльність.
> **План (канон): [`S5_PLAN.md`](S5_PLAN.md)** — dependency-ordered waves A→D, контракти, ідемпотентність, інваріанти, test-list (з understand-workflow). **Порядок:** S5-01 → міграція `s5_00_financial_core` → S5-03a(ExchangeRate) → S5-02(payments) → ledgers(05/07/06) → tail(08/09/04/10). Гроші=`Decimal`; concurrency=`SELECT…FOR UPDATE` (не Serializable); ідемпотентність=`IdempotencyKey` таблиця + unique-констрейнти.

| ID    | Задача                                                                                     | Модуль        | Статус |
| ----- | ------------------------------------------------------------------------------------------ | ------------- | ------ |
| S5-01 | packages/payments — PaymentProvider interface + ManualProvider + RaceGuard (single-flight) | [05-billing]  | ✅ 🧪  |
| S5-02 | API — /billing/summary /charges + POST payments + advance + idempotency                    | [05-billing]  | ✅ 🧪  |
| S5-03 | ExchangeRate НБУ cron + Services CRUD + recurring charges cron (CompanyService)            | [05-billing]  | ✅ 🧪  |
| S5-04 | API — Team rates/earnings + ExecutorPayout + company members+permissions                   | [12-team]     | ⬜     |
| S5-05 | Wallet — WalletTransaction ledger + walletCredit/Debit (інваріант, FOR UPDATE)             | [25-wallet]   | ✅ 🧪  |
| S5-06 | Wallet — referral accrual→credit + ReferralSettings (редаговані %)                         | [25/09]       | ✅ 🧪  |
| S5-07 | Wallet — money-account: PaymentAllocation + moneyBalance + стани                           | [25-wallet]   | ✅ 🧪  |
| S5-08 | Wallet — unified statement + spending (bonus/prepaid на invoice)                           | [25-wallet]   | ⬜     |
| S5-09 | Loyalty — tier-recalc cron + discount-apply + LoyaltyTierHistory                           | [10-loyalty]  | ⬜     |
| S5-10 | Finance — Expense model + CRUD + P&L (revenue−expenses, ЗП з ExecutorRate)                 | [22-finance]  | ⬜     |
| S5-11 | Portal — /billing /wallet /referrals /loyalty                                              | [05/25/09/10] | ⬜     |
| S5-12 | Workspace — /billing /payouts /services /team /finance /admin-wallet                       | [05/12/22/25] | ⬜     |
| S5-13 | Deploy Sprint 5 → staging                                                                  | Infra         | 🚀     |

> **Прогрес (2026-06-08, backend-first):**
> — **S5-01 ✅** `@workflo/payments` (PaymentProvider+ManualProvider+RaceGuard single-flight), 13 тестів.
> — **`s5_00_financial_core` міграція ✅** (WAVE A foundation): 7 net-new моделей (WalletTransaction, PaymentAllocation, ReferralSettings, LoyaltyTierHistory, ExecutorPayout, Expense, IdempotencyKey) + дельти (Payment.amountUsd/rateUsed/sourceType/sourceId+`@@unique`, ServiceCharge.base/discount/total/currency+allocations, CompanyService.frequency/nextChargeAt, Company.moneyBalance/tierOverride, Service.isRecurring/defaultPriceUsd) + 8 enum'ів + ChargeStatus(+partial/+written_off) + **RLS** `tenant_isolation` на всіх 7 (F4-патерн). Згенеровано через `migrate diff` на throwaway PG16, **drift-free**, клієнт regenerated. Гейт 21/21·13/13·19/19.
> — **S5-03a ✅** ExchangeRate НБУ cron: `apps/api/src/cron/{index,exchangeRate}.ts` — `syncExchangeRates` (per-agency upsert, fetch-fail→keep-last+warn, stale>3d warn) + daily 06:10 UTC scheduler (setTimeout→setInterval, no node-cron) wired у `startWorkers`. 10 тестів (mock fetch+prisma). Settings-endpoints (GET/PATCH/refresh) → S5-03b.
> — **WAVE B ✅ — S5-02** idempotent billing payments + reads: `confirmManualPayment` (`SELECT…FOR UPDATE` на order, Decimal-математика, immutable `amountUsd`/`rateUsed`-снапшот, re-pay guard) обгорнутий у `withIdempotency`+`tenantTransaction`; `/billing/summary` /charges /overview /payments + paymentSettings. **S5-03b** services-каталог + CompanyService-підписки + recurring-charge cron (idempotent через `@@unique([companyServiceId, month])`).
> — **WAVE C ✅ (ledgers) — S5-05** bonus-гаманець: `walletCredit`/`walletDebit` (company-row `FOR UPDATE`, інваріант `bonusBalance == Σcredit − Σdebit ≥ 0`, debit-guard 409) + portal/admin wallet-endpoints. **S5-07** money-account: `allocatePayment` (payment-row `FOR UPDATE` → `Σalloc ≤ amount` else 409, `@@unique([paymentId, chargeId])`, FIFO-by-dueDate), derived charge-state (awaiting/partial/paid/overdue/overpaid; stored → nearest `ChargeStatus`), single-writer `recomputeMoneyBalance = Σ(no-order confirmed payments).amountUsd − Σ(charge.totalAmount)` (order-track виключений). **S5-06** referral-accrual → `walletCredit` (in-tx з payment-confirm, idempotent `ON CONFLICT(sourceType,sourceId)`, історичний `percent` immutable) + `ReferralSettings` GET/PATCH. Порядок виконання: 05 → 07 → 06 (06 та 07 склались чисто, спільних файлів немає, `confirmManualPayment` лишився цілим окрім no-op referral-хука).
> — **Гейт (S5-07):** type-check 21/21 · lint 13/13 · build 13/13 · test (api 294 unit + **37 integration проти живого PG**, з них 9 нових allocation-інваріантів: FOR-UPDATE concurrency, over-allocation 409, FIFO, order-exclusion, recompute) · types 29 · payments 13 · notifications 64.
> — **Далі (WAVE D — convergence tail):** S5-08 (unified statement + bonus-spend на invoice; залежить від 05+07), S5-09 (loyalty tier-recalc cron + discount-apply), S5-04 (team rates/earnings + ExecutorPayout — незалежний, можна паралельно), S5-10 (Expense + P&L).

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

| Фаза                           | Спрінти      | Статус                                                                                 |
| ------------------------------ | ------------ | -------------------------------------------------------------------------------------- |
| Foundation                     | S0, S1, S1.5 | ✅ done                                                                                |
| Tenancy + schema               | S1.6         | ✅ done                                                                                |
| Orders/Chat/Files backend      | S2           | ✅ done                                                                                |
| MVP ядро frontend              | S3-S4        | 🔄 S3 екрани ✅ (auth+orders+detail+settings+team+invite) · лишилось: responsive + E2E |
| Billing/Wallet/Finance backend | S5           | ⬜ next                                                                                |
| MVP доки+контент               | S6-S7        | ⬜                                                                                     |
| MVP launch v0.1.0              | S8           | ⬜                                                                                     |
| Повний продукт (фічі)          | S9-S14       | ⬜                                                                                     |

> **MVP-межа:** S8 (v0.1.0, перший клієнт). **Повноцінний продукт:** через S14.
> Деталі скоупу кожного модуля — `SPEC.md` + `modules/NN-*.md`.
