# ADR-004: Multi-Tenancy — Tenant-Ready Architecture

**Статус:** Прийнято
**Дата:** 30 травня 2026
**Контекст:** Рішення власника — workflo має стати повноцінним продуктом, який згодом можна продавати ІНШИМ агенціям (SaaS), але зараз працює як один tenant (твоя агенція). Треба закласти межу tenant у схему ЗАРАЗ (поки даних мало), не будуючи повний SaaS негайно.

---

## Рішення

Обрано **Tenant-ready** (не повний SaaS зараз, не «без tenancy»):

- Вводимо рівень **`Agency`** (tenant root) над клієнтськими компаніями.
- Agency-scoped таблиці отримують `agencyId`.
- Запускаємось як **один tenant** (твоя агенція = `Agency` #1, seed-рядок). Реєстрації агенцій / signup-флоу **немає** (вмикається пізніше без переписування).
- `can()` отримує tenant-guard: користувач діє лише в межах своєї агенції.

Це найдешевша страховка проти найдорожчого ретрофіту (додавання tenancy у живу БД з даними = міграція кожної таблиці + переписування authz).

---

## Модель

```prisma
/// Tenant root. MVP: один seed-рядок (твоя агенція).
model Agency {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  ownerId   String?  // головний owner агенції (Profile)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  companies Company[]
  // ...решта agency-scoped relations
  @@map("agencies")
}
```

### Що scoped по `agencyId` (пряма колонка)

- `companies` — клієнтська компанія належить агенції, яка її обслуговує.
- `departments`, `services`, `service_nomenclature`, `executor_rates` — внутрішні ресурси агенції.
- `pdf_branding`, `referral_settings`, `notification_templates`, `smtp_senders` — налаштування агенції (раніше singleton → тепер per-agency).
- `audit_logs` — для ізоляції аудиту між агенціями.

### Що scoped похідно (через company.agencyId)

- `orders`, `documents`, `payments`, `service_charges`, `wallet_transactions`, `order_comments`, `time_logs` — належать компанії → агенції. **Денормалізуємо `agencyId`** на гарячі таблиці (orders, payments, documents) для швидких tenant-scoped запитів + composite-індекси `(agencyId, ...)`.

### Profile — глобальна ідентичність, agency-контекст через зв'язки

- `Profile` (людина/логін) **лишається глобальним** (один email = один акаунт). Не ставимо `agencyId` на сам Profile.
- Agency-контекст приходить через relationships:
  - **Клієнт**: `CompanyMember` → `Company.agencyId`.
  - **Виконавець/owner**: нова `AgencyMember { agencyId, profileId, role }` (executor/owner у конкретній агенції).
- Один профіль теоретично може бути клієнтом агенції A і виконавцем агенції B (рідко, але модель це дозволяє без конфліктів).

---

## JWT claims (доповнення)

```json
{
  "sub": "profile-uuid",
  "role": "owner|executor|client",
  "activeAgencyId": "agency-uuid", // ← новий: поточний tenant сесії
  "activeCompanyId": "company-uuid",
  "agencyMemberships": [{ "agencyId": "...", "role": "owner|executor" }],
  "memberships": [{ "companyId": "...", "role": "owner|member", "permissions": {} }]
}
```

`activeAgencyId` визначається з активної компанії (для клієнта) або з agency-membership (для виконавця). Перемикання агенції (для multi-agency-профілю) — окремий endpoint, як `/auth/switch-company`.

---

## `can()` tenant-guard

Кожна перевірка, що стосується ресурсу агенції, спершу звіряє tenant:

```typescript
function sameTenant(user: AccessClaims, resourceAgencyId: string): boolean {
  return (
    user.agencyMemberships.some((m) => m.agencyId === resourceAgencyId) ||
    user.memberships.some((m) => /* company.agencyId === resourceAgencyId */ true)
  )
}
// У can(): якщо resource.agencyId заданий і !sameTenant → deny (cross-tenant).
```

Дефолт — deny на cross-tenant. Це закриває IDOR між агенціями ще до feature-level правил.

---

## Фази впровадження

**Фаза 0 — зараз (tenant-ready foundation, до S2):**

- Додати `Agency` + `AgencyMember` + `agencyId` на agency-scoped таблиці (поки БД мала/порожня — дешево).
- Seed: 1 Agency (твоя), всі наявні дані → `agencyId` = вона.
- per-agency налаштування (branding/referral/templates/smtp) з singleton → scoped (key = agencyId).
- JWT claims + `can()` tenant-guard.
- **Без** agency-signup UI, без per-agency реєстрації.

**Фаза 1 — пізніше (вмикання SaaS):**

- Agency signup + onboarding.
- Per-agency subdomain / branding в рантаймі.
- Agency-level білінг (підписка на workflo) — див. SaaS-billing.
- Адмін платформи (super-admin над агенціями).

---

## Наслідки

- **Forward-compatible:** продаж іншим агенціям = вмикання signup, а не переписування.
- **Ізоляція з дня 1:** cross-tenant IDOR неможливий (tenant-guard).
- **Вартість зараз:** ~1 міграція (додати Agency + agencyId + backfill 1 tenant) + оновлення claims/can(). Робимо **до S2**, щоб order/billing-ендпоінти були tenant-scoped з самого початку.
- **Складність:** усі agency-scoped запити мають фільтрувати по `agencyId` (дисципліна; покривається репозиторій-хелперами + code-review).

---

## Зв'язок з іншими рішеннями

- **SaaS-billing + ліміти планів** — будується на `Agency` (підписка агенції). Залежить від цього ADR.
- **Full RBAC (task #24)** — ролі/політики стають per-agency.
- **Public API + webhooks** — scoped по агенції (API-ключ належить агенції).
- **Search / analytics** — індекси/події scoped по `agencyId`.

## Перегляд

Переглянути, коли: з'явиться перший зовнішній tenant; знадобиться cross-tenant аналітика (платформний рівень); або per-tenant ізоляція даних (окремі схеми/БД).

---

## Amendment (аудит 31.05.2026) — структурне tenant-enforcement

Tenant-ізоляція НЕ покладається на дисципліну в кожному хендлері. Інструменти — `apps/api/src/auth/tenant.ts`:

- **`requireActiveAgency(user)`** — дістати tenant сесії (звідси, не з тіла запиту).
- **`assertSameTenant(user, resource.agencyId)`** ПІСЛЯ кожного resource-fetch — 403 на крос-тенант (доповнює `can()` tenant-guard для flow «завантажив → перевірив»).
- **`tenantWhere(agencyId, extra)` / `tenantData(agencyId, data)`** — фільтр/штамп `agencyId`.

`null` `resourceAgencyId` → deny (un-stamped рядок невидимий жодному тенанту). Покрито `tests/tenant.test.ts`.

### Уточнення за аудитом S0-S2 (1.06.2026)

**Реальний guard у S2-коді** (а не як було спершу заявлено): первинний рубіж — **`assertSameTenant` + resource-loader'и** `requireOrderParticipant` / `requireTeamOrder` (`routes/orders/access.ts`), що присутні у **всіх** S2-роутах (orders + sub-resources). `requireActiveAgency` використовується для list/create. **`tenantWhere`/`tenantData` наразі НЕ застосовані в роутах** — зарезервовані під RLS-seam (SAAS.md F4). create-роути штампують `agencyId` із сесії через `agency:{connect}`/денормалізацію, ніколи з body.

Заплановано (AUDIT_S0_S2 → T-D2/T-D3, до розростання роутів на S3+):

- винести `requireOrderForWrite` loader і прибрати дубльований inline-IDOR з 5 прямих order-роутів (зараз безпечно, але дублювання → ризик «забути `assertSameTenant`» при copy-paste);
- закласти Prisma `$extends`-seam + tenant-context middleware (`SET LOCAL app.current_agency_id`) — щоб гарантія стала структурною на рівні БД (RLS), а не лише per-handler.

**Rate-limit (операційне обмеження):** `@fastify/rate-limit` зараз in-memory → коректний лише при **одній репліці API**. Auth brute-force-ліміти (`/auth/login` 10/15хв) залежать від цього. Перед horizontal scale — Redis-store АБО свідомо лишати 1 репліку (зафіксовано в BACKLOG).

---

## Amendment (1.06.2026) — повний SaaS-план + RLS

Власник підтвердив намір продавати платформу іншим агенціям. Деталізований план — у [`../SAAS.md`](../SAAS.md). Ключове:

- **Поділ Foundation/Enablement.** Структурне (схема/запити) — закладаємо ЗАРАЗ (S0–S2), бо ретрофіт у живу мультитенантну БД дорогий. Продуктове (signup/біллінг агенції/branding-рантайм/super-admin) — окремий пізній спрінт (Phase 1), без міграції даних. Тобто «перевести на SaaS у кінці» = безпечно, якщо Foundation закладено.
- **Foundation-доповнення (F1–F6 у SAAS.md):** SaaS-поля `Agency` (nullable: `subdomain`/`plan`/`subscriptionStatus`/`trialEndsAt`/`billingCustomerId`/`suspendedAt`/`limits`); `provisionAgency()`-фабрика тенанта (seed перевикористовує); quota/feature **seam** у create-ендпоінтах (no-op зараз); tenant-aware rate-limit key; `BASE_DOMAIN` + wildcard subdomain (інфра).
- **RLS-рішення (доповнює, не замінює app-level scoping):** перед першим зовнішнім тенантом вмикаємо **Postgres Row-Level Security** як другий рубіж — навіть забутий `where agencyId` фізично не поверне чужі рядки. Конвенцію (`current_setting('app.current_agency_id')` + per-table policy + Prisma-extension, що ставить GUC у tx) закладаємо у фундамент, політики додаємо по таблиці. Структурні хелпери `tenant.ts` лишаються первинним guard'ом; RLS — belt-and-suspenders.
- **Перегляд глибини ізоляції** (shared-DB+RLS → schema/DB-per-tenant) — без змін: на 100+ тенантів або вимозі фізичної ізоляції.
