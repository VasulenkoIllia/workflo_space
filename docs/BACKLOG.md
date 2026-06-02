# BACKLOG

**Призначення:** capture-буфер. Не плутати з `TRACKER.md` (спрінти) чи `SPEC.md`/модульними доками (стабільні рішення).

**Стан (30.05.2026):** після помодульного пропрацювання беклогу кожен пункт отримав **явну диспозицію** — або промоут у план (`TRACKER.md`), або підтверджене відкладення з тригером перегляду, або genuine-research. Лімбо немає.

Формат: `- [контекст] Опис. User value. (created: YYYY-MM-DD)`

---

## 🔧 Аудит S0-S2 (1.06.2026) — відкладені пункти

> Повний аудит + 6 виправлених проблем — `AUDIT_S0_S2.md`. Нижче — те, що свідомо відкладено (severity · тригер).

**До розростання роутів (FDN-follow-up, бажано до/на старті S3):**

- [arch] **T-D1 outbox-drain воркер** (HIGH): `transitionOrderStatus` enqueue-ить у прод, drain нема → події копляться. Завести мінімальний drain+handler-registry у **S6** (або раніше, якщо S5-білінг стартує). (created: 2026-06-01)
- [arch] **T-D2 `requireOrderForWrite` loader** (HIGH-maint): прибрати дубльований inline-IDOR з 5 прямих order-роутів (зараз безпечно через `assertSameTenant`, але дублювання). (created: 2026-06-01)
- [arch] **T-D3 RLS + Prisma `$extends`-seam + tenant-context middleware** (HIGH, SAAS.md F4): закласти seam, поки роутів ~25; політики per-table — перед зовнішнім тенантом. (created: 2026-06-01)
- [arch] **T-D4 F2 quota-seam + F5 tenant-rate-limit-key** (MEDIUM, SAAS.md): no-op `assertWithinQuota` у create-точках; F5 потребує per-route post-auth limits. (created: 2026-06-01)
- [notify] **N-D1 уніфікувати 3 шляхи нотифікацій** (MEDIUM): auth=direct / orders=outbox / chat=нічого. ADR-правило + перевести на outbox коли запрацює drain. (created: 2026-06-01)

**Schema hardening (перед Phase 1 / multi-agency):**

- [db] **S-D1** `orders.agencyId` → NOT NULL + FK `RESTRICT` (зараз nullable + SET NULL). (HIGH) (created: 2026-06-01)
- [db] **S-D2** singletons без `agencyId`: `PaymentSettings`/`DocumentCounter`(спільна нумерація!)/`ExchangeRate`. (HIGH) (created: 2026-06-01)
- [db] **S-D3** `InternalTask`+`ActivityLog` без `agencyId` (виняток F6) + ADR «audit vs activity». (MEDIUM) (created: 2026-06-01)
- [db] **S-D4** `order_chat_reads` без FK на orders/profiles → ghost-рядки. (MEDIUM) (created: 2026-06-01)
- [db] **S-D5** `Service.agencyId`/`Referral` agencyId; money `CHECK (>=0)`. (LOW) (created: 2026-06-01)

**Перформанс / масштаб (коли зʼявляться обсяги):**

- [db] **I-D1** composite-індекси `order_comments(orderId,deletedAt,isInternal,createdAt)`, `order_files(orderId,deletedAt,createdAt)`; прибрати надлишкові одинарні на `orders`. (HIGH) (created: 2026-06-01)
- [db] **I-D2** `listOrders` OFFSET → cursor; ILIKE → GIN tsvector. (HIGH) (created: 2026-06-01)
- [db] **I-D3** `comments` 3-query → batch; `timeLogs`/`internalTasks` `take`; `totalHours` SQL-aggregate. (MEDIUM) (created: 2026-06-01)
- [scale] **SC-D1** PrismaClient `connection_limit`/PgBouncer (горизонт. скейл). (HIGH перед multi-replica) (created: 2026-06-01)
- [scale] **SC-D2** retention-крони (audit 365д/notif 90д/outbox 7д) — інфра-крон. (MEDIUM) (created: 2026-06-01)

**Concurrency:**

- [db] **C-D1** status-transition `FOR UPDATE`/version (concurrent double-PATCH). (MEDIUM) (created: 2026-06-01)
- [db] **C-D2** `orderChatRead.upsert` → `ON CONFLICT DO UPDATE GREATEST`. (LOW) (created: 2026-06-01)

**Якість/підтримка:**

- [code] **M-D1** `deleteOrder`/`assignOrder` провести через `can()` (ADR-002). (MEDIUM) (created: 2026-06-01)
- [code] **M-D2** `login.ts` уніфікувати з `loadMemberships`+`resolveActiveAgencyId`. (MEDIUM) (created: 2026-06-01)
- [code] **M-D3** `assertAgencyMember` винести в `orders/access.ts`. · **M-D4** magic-рядки → enum. · **M-D5** тести per-`it` `buildApp` → `beforeAll`. · **M-D6** notify per-event zod. (LOW) (created: 2026-06-01)

**Безпека (hardening, не активні):**

- [sec] **SEC-D1** MIME magic-byte sniffing. · **SEC-D2** `avatarUrl` domain-allowlist. · **SEC-D3** `Invite.token` без `@default(uuid())`. · **SEC-D4** dev-CVE `pnpm update` (vite/esbuild/postcss/turbo). · ~~**SEC-D5** `Profile.role='owner'` → `isInternalTeam()`~~ ✅ **виправлено 1.06** (`isInternalTeam()` на базі `agencyMemberships` у 8 order-роутах + `can()`; owner більше не заблокований; +regression-тест). (LOW-MEDIUM) (created: 2026-06-01)

---

## ✅ Закрито / промоутнуто в план (історія)

> Прибрано з активного беклогу.

**Реалізовано (код):** D1 `can()`-permissions, D2 `notifyRecipient()`, D5 enum-drift test, centralized error-formatter, Payment.status enum, ExecutorRate-поля. (S1/S1.5)
**Абсорбовано у модулі (фіналізація 30.05):** bot-inline (15), reports-PDF/XLSX (19), credentials-2FA-reveal (17), /status-page (21), S3/R2-adapter-рішення (04), payment-providers-архітектура (05).
**Промоутнуто в TRACKER (вікторина 30.05):**

- Quiet-hours / digest → **S12-06** (модуль 07).
- Bulk-розсилки → **S12-07** (модуль 07).
- Темна тема Portal → **S9-07** (модуль 13).
- Retention-аналітика → **S11-07** (модуль 19).
- Soft-delete restore UI → **S10-07** (модуль 02).
- Migration smoke-test → **S8-06**; On-call runbook → **S8-07**; Public API Swagger → **S11-07**.

---

## ✅ Підтверджено відкладено (вікторина 30.05) — revisit post-launch

> Свідоме рішення «не зараз». Тригер перегляду — після живого MVP / коли зʼявиться потреба. Кожне має готову архітектурну зачіпку в доку модуля.

| Фіча                                       | Модуль | Тригер перегляду                        |
| ------------------------------------------ | ------ | --------------------------------------- |
| Coupons / промокоди                        | 05     | коли потрібен маркетинг-інструмент      |
| LiqPay провайдер                           | 05     | разом із go-live online-оплати (S14)    |
| Cash-out бонусів (виведення грішми)        | 09/25  | коли обсяг бонусів суттєвий             |
| Multi-level реферал (2-й рівень)           | 09     | якщо реферальна програма «вистрелить»   |
| Scheduled blog publishing                  | 11     | коли контент-потік регулярний           |
| Skills-matrix виконавців (авто-розподіл)   | 12     | коли команда > ~10 виконавців           |
| Держсвята UA (auto-exclude робочих днів)   | 23/24  | разом із accrual-точністю відпусток     |
| Версіонування файлів                       | 04     | коли часті ітерації дизайн-файлів       |
| Virus-scan завантажень (ClamAV)            | 04     | перед широким клієнтським file-exchange |
| Slack notification adapter                 | 07     | коли зʼявиться клієнт зі Slack-командою |
| Geo login-audit (IP→місто + new-loc alert) | 01     | post-launch security-hardening          |

---

## 🔍 Audit S0-S1 follow-ups (31.05.2026) — див. `AUDIT_S0_S1.md`

> Знайдено критичним аудитом; баги/security вже виправлено. Нижче — покращення під масштаб + supply-chain (потребують власного verify-циклу).

- ✅ [dep] **dep-CVE updates** — DONE: fastify→5.8.5, @fastify/jwt→10.1.0, next→15.5.18 (verify green). (2026-05-31)
- ✅ [arch] **tenant-enforcement** — DONE: `apps/api/src/auth/tenant.ts` (`tenantWhere`/`tenantData`/`requireActiveAgency`/`assertSameTenant`) + ADR-004 amendment + tests. Mandatory для S2-хендлерів. (2026-05-31)
- ✅ [db] **Композитні tenant-індекси (orders)** — DONE: `(agencyId,internalStatus)`,`(agencyId,createdAt)`,`(agencyId,companyId)`. payments/documents/audit-композити — з їхніми спрінтами (S5/S6/S7). (2026-05-31)
- [db] **agencyId NOT NULL + ON DELETE RESTRICT** на hot/resource-таблицях — до multi-agency (Phase 1); у Phase 0 всі backfilled. (created: 2026-05-31)
- [db] **PaymentSettings.agencyId** (зараз глобальний singleton) — до S5/multi-agency. (created: 2026-05-31)
- [db] **UUIDv7** для high-volume PK (notification_logs/audit_logs/time_logs/outbox_events) — фрагментація UUIDv4. (created: 2026-05-31)
- [api] **`createSession(tx, profile, reply)`** DRY — register/login/refresh дублюють claims+memberships+agency+refresh+cookie. (created: 2026-05-31)
- [api] **env → один typed Zod-схема** — COOKIE_DOMAIN/ADMIN_EMAIL/PORTAL_URL/CORS валідувати при старті (зараз розкидані `process.env.X ?? default`). (created: 2026-05-31)
- [api] **Спільний allowed-origins** для cors.ts + refresh CSRF-guard (зараз розходяться при unset CORS_ALLOWED_ORIGINS). (created: 2026-05-31)
- ✅ [ops] **rate-limit single-replica** — DONE (constraint задокументовано: коментар у rateLimiting.ts + ADR-004 amendment). Redis-store — коли зʼявиться horizontal scale. (2026-05-31)

---

## 🌱 Foundation seams (рішення задокументоване, код у плані)

- [D3] Спільний date-range primitive leave+calendar (док 23/24; код S13). (created: 2026-05-29)
- [D4] Recurring-billing на CompanyService/ServiceCharge (док 05; код S5). (created: 2026-05-29)
- [chat] @-mention picker — participants endpoint + explicit `mentionedUserIds` (док 03; код S10-05). (created: 2026-05-29)
- [api] DRY session helper `createSession(tx, profileId, reply)` (S1.6/рефактор). (created: 2026-05-29)
- [api] `can()` executor-management під admin-guard (модулі 12/13; S5). (created: 2026-05-29)
- [expense] Expense immutability — `validFrom`/`validUntil` + FK замість `sourceRef` + soft-delete (модуль 22; S13). (created: 2026-05-29)

---

## 🗄 DB hardening (заплановано S1.6 — S16-07/08)

- telegramChatId dedup (NotificationSettings authoritative). • Відсутні FK-індекси (Invite/PasswordResetToken/Referral/Payment/Document/BlogPost/OrderComment). • drop `OtpToken @@index([code,purpose])`. • explicit `onDelete` Order.company. • `Decimal(10,4)` для exchange-rate. • UUIDv7/BIGINT PK для НОВИХ high-volume таблиць. (created: 2026-05-29)

---

## 🧪 Genuine research (бізнес-рішення, не білд)

- [billing] Go-live провайдер: Monobank Acquiring vs Stripe (UA-резиденство/комісії/payout). Архітектура `PaymentProvider` готова. → рішення перед S14. (created: 2026-04-15)
- [storage] Тригер переходу local FS → Cloudflare R2 (обсяг/CDN-потреба). Адаптер готовий (04). (created: 2026-04-16)
- [rbac] Повний CASL vs `can()` shim для enterprise (task #24, post all-modules-stable). (created: 2026-04-19)

---

## 🐛 Виявлені баги (без severity SEV0/1)

- _(порожньо — критичні з аудиту виправлено в 711f506)_

---

> **Правило:** ідея у BACKLOG > 90 днів без обговорень — видаляємо. Не реалізовано = не потрібно зараз.
