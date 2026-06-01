# Аудит S0–S2 (код / патерни / безпека / підтримуваність)

> Дата: 1 червня 2026 · Метод: 5 спеціалізованих рев'юерів паралельно (security, typescript, database, code-quality, architecture) над `apps/api/src/**`, `packages/{db,types,storage,notifications}/src/**`, `schema.prisma`, міграції, тести.
> Стан після аудиту: **type-check 19/19 · lint 13/13 · тести api 168 / notif 64 / types 26 / storage 8 / i18n 7 — зелені.**

## Загальний вердикт

Фундамент **зрілий**: tenant-колонки + composite-індекси в схемі, `provisionAgency()`, чисті адаптери (Storage/notify/Payment), SSE shared-LISTEN-bus із подвійним leak-guard, storage tenant-prefixed keys, `assertSameTenant(null)→deny`, рівень документації рішень (ADR + amendments) — зроблено правильно. **Жодного критичного активно-експлуатованого витоку не знайдено** (cross-tenant IDOR закритий `assertSameTenant`/loaders у всіх S2-роутах; SSE/chat leak-guard подвійний; SQL-injection немає — `$queryRaw` лише tagged-template; mass-assignment немає — всюди явний whitelist `data`).

Виправлено зараз **6** проблем (безпека/коректність, низький ризик). Решта — структуровано відкладена з обґрунтуванням «зараз vs потім».

---

## ✅ Виправлено (цей коміт)

| #   | Severity                    | Файл                                                              | Проблема → фікс                                                                                                                                                                                                                                                  |
| --- | --------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | HIGH (leak)                 | `routes/orders/activity.ts`                                       | `GET /orders/:id/activity` віддавав клієнту внутрішні статуси (`on_hold`/`review`) + internal-коментар переходу. → для не-internal метадані транслюються у client-статуси (`INTERNAL_TO_CLIENT_STATUS`), `comment` прибирається; executor бачить сире. +2 тести. |
| F2  | HIGH (correctness)          | `routes/orders/getOrder.ts`, `listOrders.ts`                      | Prisma `Decimal` (`totalAmount`/`fixedPrice`/`hourlyRate`/`estimatedHours`) серіалізувався як **рядок** `"500.00"` (timeLogs повертав number — неконсистентно). → `Number()`-конверсія, узгоджено.                                                               |
| F3  | HIGH (future tenant-safety) | `auth/agency.ts`                                                  | `resolvePlatformAgencyId` робив `findFirst(orderBy:createdAt)` — у Phase 1 призначав би нові компанії «найстарішій» агенції. → `findUnique({where:{slug:'workflo'}})`.                                                                                           |
| F4  | MEDIUM (race)               | `routes/invites/createExecutorInvite.ts`, `createMemberInvite.ts` | supersede(`updateMany`)+`create` поза транзакцією → double-submit лишав два живі інвайти. → обгорнуто в `$transaction`.                                                                                                                                          |
| F5  | MEDIUM (robustness)         | `routes/files/index.ts`                                           | blob писався у storage ДО `orderFile.create`; фейл insert → orphan-blob назавжди. → on-failure `storage.delete(key)`.                                                                                                                                            |
| F6  | MEDIUM (hygiene)            | `packages/db/prisma/seed.ts`                                      | паролі друкувались у stdout завжди + хардкод для executor/client. → env-оверрайди (`SEED_*_PASSWORD`) + друк лише поза production.                                                                                                                               |

Документаційний фікс: ADR-004 amendment приведено у відповідність до реального коду (див. нижче, T-D2).

---

## ⏳ Відкладено (з обґрунтуванням «зараз vs потім»)

### Архітектура / tenant-enforcement

- **[HIGH] T-D1 — Outbox без воркера.** `transitionOrderStatus` уже enqueue-ить `order.status_changed` у прод, але drain-loop ніхто не запускає (S6) → події накопичуються, нотифікація не йде. **Рішення:** enqueue лишаємо (durable, коректно); мінімальний drain + handler-registry завести у **S6** (де й notify-recipient-логіка). Якщо S5-білінг почнеться раніше — підтягнути drain туди. Зафіксовано як перший must у S6.
- **[HIGH] T-D2 — `tenantWhere`/`tenantData` не використовуються** (мертві), хоча ADR називав їх «mandatory». Реальний guard = `assertSameTenant` + loader'и `requireOrderParticipant`/`requireTeamOrder` (присутні в усіх S2-роутах — безпечно). **Зроблено зараз:** ADR-004 приведено у відповідність. **Відкласти:** (а) витягнути `requireOrderForWrite` loader і прибрати дубльований inline-IDOR з 5 прямих order-роутів; (б) лишити `tenantWhere`/`tenantData` як основу для RLS-seam.
- **[HIGH] T-D3 — RLS + Prisma `$extends`-seam + tenant-context middleware не закладені (SAAS.md F4).** Структура (`agencyId`-колонки) є; seam під `SET LOCAL app.current_agency_id` — ні. Дешевше закласти, поки роутів ~25. **Зробити** як окремий FDN-блок до того, як S3–S8 розростуть роути; самі `CREATE POLICY` — per-table перед першим зовнішнім тенантом.
- **[MEDIUM] T-D4 — F2 quota-seam + F5 tenant-rate-limit-key (SAAS.md).** `assertWithinQuota()`/`featureEnabled()` no-op у create-точках; rate-limit per-tenant. F5 нетривіальний (`request.user` недоступний у глобальному keyGenerator до auth → треба per-route limits post-auth або tenant-resolving onRequest). Закласти у FDN-блок T-D3.

### Notify-концепт

- **[MEDIUM] N-D1 — три шляхи нотифікацій** (auth=direct, orders=outbox-без-drain, chat=нічого; `chat.new_comment`-шаблон є, виклику нема). Зафіксувати правило (durable=outbox / realtime=SSE / both) одним ADR-абзацом; перевести chat+status на outbox, коли запрацює drain (T-D1).

### Schema hardening (перед Phase 1 / multi-agency)

- **[HIGH] S-D1 — `orders.agencyId` nullable + FK `ON DELETE SET NULL`** → зробити `NOT NULL` + `RESTRICT` (backfill готовий — усі orders мають agencyId з S1.6).
- **[HIGH] S-D2 — singletons без `agencyId`:** `PaymentSettings`, `DocumentCounter` (спільна нумерація!), `ExchangeRate` — scoped перед другим тенантом.
- **[MEDIUM] S-D3 — `InternalTask` + `ActivityLog` без `agencyId`** (виняток із F6; інші order-діти мають). Денормалізувати наступною міграцією + ADR «audit vs activity» межа.
- **[MEDIUM] S-D4 — `order_chat_reads` без FK** на orders/profiles → ghost-рядки після видалення. Додати FK `ON DELETE CASCADE`.
- **[LOW] S-D5 — `Service.agencyId`/`Referral` agencyId**, money-`CHECK (>=0)` constraints.

### Індекси / масштаб (perf-pass, коли зʼявляться обсяги)

- **[HIGH] I-D1 — composite-індекси під S2-запити:** `order_comments (orderId, deletedAt, isInternal, createdAt)`, `order_files (orderId, deletedAt, createdAt)`; прибрати надлишкові одинарні на `orders` (internalStatus/clientStatus/type/createdAt/deletedAt — завжди в парі з agencyId).
- **[HIGH] I-D2 — `listOrders` OFFSET → cursor**; ILIKE-search → GIN `tsvector`.
- **[MEDIUM] I-D3 — `comments` 3 запити → `$transaction` batch; `timeLogs`/`internalTasks` додати `take`; `totalHours` через SQL `aggregate`.**
- **[HIGH] SC-D1 — `PrismaClient` без connection-pool ліміту** → `?connection_limit` / PgBouncer (горизонтальний скейл; зараз 1 репліка — ок).
- **[MEDIUM] SC-D2 — retention-крони** (audit 365д / notification 90д / outbox done|dead 7д) — інфра-крон, раніше за продуктові.
- **[LOW] SC-D3 — UUIDv7** для нових high-volume таблиць (write-amplification на млн рядків).

### Concurrency

- **[MEDIUM] C-D1 — status transition без `FOR UPDATE`** (read поза tx) → два паралельні PATCH можуть обидва пройти. Перенести read у tx з lock, або `version`-колонка (optimistic).
- **[LOW] C-D2 — `orderChatRead.upsert` race** → `INSERT ... ON CONFLICT DO UPDATE SET lastReadAt = GREATEST(...)`.

### Якість / підтримуваність

- **[MEDIUM] M-D1 — `deleteOrder`/`assignOrder` обходять `can()`** (пряма перевірка ролі) → провести через `can('order.delete'/'order.assign')` (ADR-002 «drop-in RBAC»).
- **[MEDIUM] M-D2 — `login.ts` дублює membership/activeAgencyId-логіку** замість `loadMemberships`+`resolveActiveAgencyId` (ризик розходження на Phase 1).
- **[MEDIUM] M-D3 — `assertAgencyMember` дубльований** (internalTasks + assignOrder) → винести в `orders/access.ts`.
- **[LOW] M-D4 — magic status/role-рядки** → enum-константи з `@workflo/types`.
- **[LOW] M-D5 — тести: per-`it` `buildApp()`** → `beforeAll` (швидкодія, менше відкритих instance).
- **[LOW] M-D6 — notify: вручну-дубльовані Prisma-shape інтерфейси + `vars` без zod-валідації per-event** (drift-ризик).

### Безпека (hardening, не активні вразливості)

- **[MEDIUM] SEC-D1 — MIME magic-byte sniffing** (зараз лише декларований Content-Type; `attachment`+`nosniff` уже мітигують основний XSS-вектор).
- **[MEDIUM] SEC-D2 — `avatarUrl` без domain-allowlist** (tracking-beacon/SSRF-if-proxied).
- **[LOW] SEC-D3 — `Invite.token` прибрати `@default(uuid())`** (гарантувати лише opaque-токени).
- **[LOW] SEC-D4 — dev-CVE** (vite/esbuild/postcss/turbo — dev-scope) — `pnpm update`.
- **[LOW] SEC-D5 — `Profile.role='owner'` логічна діра** — зараз owner-profile фактично заблокований від internal-ресурсів (executor-only); ввести `isInternalTeam(user)` або прибрати `owner` з `Profile.role`.

---

## Зроблено зразково (не чіпати)

`provisionAgency`-factory · notify-package DI (залежить лише від структурного підмножини Prisma) · SSE shared-LISTEN bus + подвійний leak-guard · storage tenant-prefixed keys + `PathTraversalError` · `assertSameTenant(null)→deny` · refresh-token rotation (атомарний `updateMany` + Origin/SameSite CSRF) · DB↔schema без дрейфу (міграції verified на throwaway) · рівень ADR-документації.

> Деталі знахідок (file:line) — у git-історії цього коміту (5 рев'ю-звітів). Відкладені пункти продубльовано в `BACKLOG.md`.
