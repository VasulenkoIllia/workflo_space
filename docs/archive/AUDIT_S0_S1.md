# Критичний аудит S0-S1 (31 травня 2026)

> Повний аудит **реалізованого** коду (S0 + S1 + S1.5 + S1.6 tenancy) — security, code-quality/reuse, БД, TypeScript, архітектура. 5 паралельних рев'юерів → синтез → виправлення. Frontend-скелети й документація невбудованих модулів — поза скоупом.

**Підсумок:** усі знайдені баги/security/correctness-проблеми у shipped-коді **виправлено й перевірено** (type-check 19/19, тести 15/15 — api 76, notif 64; 11 міграцій застосовуються чисто; drift DB↔schema усунено). Архітектурні покращення під майбутній масштаб і dep-CVE — винесено у BACKLOG як трековані follow-up (потребують власного циклу верифікації).

---

## ✅ Виправлено (shipped-код)

### Security

- **JWT empty-secret fail-fast** (`plugins/jwt.ts`): прибрано `?? ''` fallback — поза dev стартап падає, якщо `JWT_SECRET` відсутній/<32 симв. (був вектор forgery у staging; нейтралізує і fast-jwt-CVE, бо секрет статичний і ніколи порожній).
- **Cross-tenant invite IDOR** (`routes/invites/createMemberInvite.ts`): додано tenant-guard `company.agencyId === user.activeAgencyId` (ADR-004).
- **CSP** увімкнено (`plugins/securityHeaders.ts`): `default-src 'none'` для JSON-API.
- **`trustProxy: true → 1`** (`app.ts`): closes IP-spoof через X-Forwarded-For (rate-limit bypass).
- **Опакові токени** (`auth/tokens.ts` `generateOpaqueToken` = 256-bit): invite + password-reset більше не UUIDv4 (`createMemberInvite`/`createExecutorInvite`/`forgotPassword`).
- **avatarUrl https-only** (`schemas/settings.schema.ts`): refine блокує `javascript:`/internal-URL (SSRF-latent).
- **Rate-limit** на публічний `GET /invite/:token` (30/15хв).

### Code reuse / quality

- **`buildDefaultPreferenceRows`** у `@workflo/types` — єдине джерело матриці нотифікацій (прибрано дубль register↔seed; виводиться з `NotificationCategory` enum).
- **`INVITE_TTL_MS`** у `@workflo/types` (був дубльований у 2 invite-роутах).
- **onTelegramBlocked → `writeAuditAsync`** (`services/notifications.ts`): прибрано прямий `prisma.auditLog.create` (консистентність).
- **register**: нормалізація `displayName`/`companyName` один раз (не `.trim()` двічі).

### TypeScript correctness

- **Outbox `$queryRaw` Zod-валідація** (`services/outbox.ts`): runtime-перевірка форми claimed-рядків (інакше тихий NaN у retry-loop).
- **`coercePermissions`** (`auth/tokens.ts`): Json→CompanyPermissions через type-guard (memberships+login) — не-обʼєктний JSON більше не дає truthy-permission.
- **dispatch.ts**: прибрано `event as string` (case-літерали тепер type-checked).
- **notify IN_APP**: при невдачі персисту статус відображає збій (errorCode), не оптимістичний 'skipped'.
- **updateProfile**: `Prisma.ProfileUpdateInput` замість `Record<string,unknown>`.

### Outbox (реальний баг — до продюсерів)

- **Stuck-`processing` reaper** + **атомарний attempts++** (`services/outbox.ts`): claim тепер `SET attempts=attempts+1, nextAttemptAt=lease` і включає протерміновані `processing` → crashed-worker рядки самовідновлюються (implicit reaper, без нової колонки). Poison-message доходить до DLQ.

### БД

- **Drift DB↔schema усунено** (`migrations/20260531_audit_drift_reconcile`): 16 індексів приведено до Prisma-конвенції (4 композитні — DROP+CREATE з правильними колонками), notification-FK `ON UPDATE CASCADE`, telegram partial→full unique, прибрано app-managed DB-defaults. **`migrate diff` тепер порожній.** One-owner-per-company partial-unique **збережено** (інваріант; Prisma його не виражає — лишається raw).
- **Invite→Company FK** + index (був orphan-prone).

### Інфра

- **`COOKIE_DOMAIN=.workflo.space`** у staging+production compose (refresh-cookie крос-сабдомен — функційний фікс).
- **pg_dump перед міграціями** у deploy (staging+production) — safety-net під DROP-DDL (best-effort, retention 10).

---

## 📋 Відкладено → BACKLOG (потребують власного циклу / під майбутній масштаб)

| Item                                                                          | Severity | Чому відкладено                                                                      |
| ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| **dep-CVE updates** (fastify≥5.8.5, @fastify/jwt, next≥15.5.16)               | HIGH     | Supply-chain — окремий verify-цикл; JWT-вектор уже закрито в коді                    |
| **forAgency() / Prisma $extends** tenant-enforcement                          | HIGH     | Структурна tenant-ізоляція; робити з першими S2-хендлерами (немає consumer-ів зараз) |
| **Композитні tenant-індекси** `(agencyId, …)` orders/payments/documents/audit | HIGH     | Під S2-запити (зараз їх немає — передчасна оптимізація)                              |
| **agencyId NOT NULL + ON DELETE RESTRICT**                                    | MEDIUM   | До multi-agency (Phase 1); у Phase 0 всі backfilled                                  |
| **PaymentSettings agencyId**                                                  | MEDIUM   | До S5/multi-agency                                                                   |
| **createSession() DRY** (register/login/refresh)                              | MEDIUM   | Рефактор якості (не баг); з тестами                                                  |
| **env → один typed-схема** (COOKIE_DOMAIN/ADMIN_EMAIL/PORTAL_URL)             | MEDIUM   | Консолідація; до росту env у S5                                                      |
| **rate-limit single-replica constraint**                                      | MEDIUM   | In-memory store; задокументувати або Redis перед horizontal scale                    |
| **UUIDv7 для high-volume** (logs/outbox)                                      | LOW      | Перф; не correctness                                                                 |

---

## Метод

5 субагентів (security / code-reviewer / database-reviewer / typescript-reviewer / architect) над `apps/api/src`, `packages/notifications`, `packages/db`, CI/compose. Кожен — пріоритезований список з file:line + фіксом. Синтез прибрав false-positives (resolver channel-guard уже є; register-409 — свідомий product-tradeoff) і дублі.
