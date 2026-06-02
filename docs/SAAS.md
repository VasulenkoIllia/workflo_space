# WORKFLO.SPACE — SaaS Plan (мультитенантне рішення)

> Статус: **План (авторитетний)** · Створено: 1 червня 2026
> Базується на: [`adr/004-multi-tenancy.md`](adr/004-multi-tenancy.md). Цей документ — ЯК увімкнути продаж платформи іншим агенціям.
> Принцип: **фундамент закладаємо зараз (S0–S2, дешево), увімкнення SaaS робимо в самому кінці (Phase 1), без переписування.**

---

## 0. TL;DR — рішення

1. **Стек міняти не треба.** Fastify + Prisma + PostgreSQL + (Next лендінг / Vite-React portal+workspace) — нормальний SaaS-стек.
2. **Мультитенантність уже є фундаментом** (S1.6): `Agency`=тенант, `agencyId` скрізь, `can()`+`tenant.ts` enforcement, JWT `activeAgencyId`. Це найдорожча частина, і вона зроблена.
3. **Що бракує — це не «переписати», а «доскладати»:** кілька структурних дрібниць закладаємо у фундамент ЗАРАЗ (бо ретрофіт дорогий), а UI/біллінг/онбординг агенцій — наприкінці.
4. **Конверсія в SaaS наприкінці = вмикання флоу, а не міграція даних.** Якщо фундамент закладено — це окремий пізній спрінт, не ризик.

---

## 1. Дві шари: Foundation vs Enablement

|           | **Foundation (ЗАРАЗ, S0–S2)**                                                                                                           | **Enablement (В КІНЦІ, Phase 1)**                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Природа   | Структурна, у схемі/міграціях/seam'ах                                                                                                   | Продуктова: UI, біллінг, флоу                                                                                                    |
| Чому тоді | Ретрофіт у живу мультитенантну БД = дорого й ризиковано                                                                                 | Не блокує MVP; вмикається без зміни даних                                                                                        |
| Приклади  | `agencyId` всюди, RLS-конвенція, SaaS-поля `Agency` (nullable), quota-seam, `provisionAgency()`, tenant-aware rate-limit, `BASE_DOMAIN` | Agency signup UI, підписка на workflo (Stripe), per-domain branding у рантаймі, super-admin, suspension/export, значення лімітів |

**Золоте правило:** усе, що **змінює схему таблиць або форму запитів**, — у Foundation. Усе, що лише **додає екрани/ендпоінти поверх готової схеми**, — у Enablement.

---

## 2. Що вже закладено (S1.6 — ✅)

- `Agency` (tenant root) + `AgencyMember{agencyId,profileId,role}`.
- `agencyId` на всіх agency-scoped таблицях (пряма колонка або денормалізована на orders/payments/documents/comments/files/time_logs/...).
- JWT: `activeAgencyId` + `agencyMemberships` + `/auth/switch-agency`.
- `can()` tenant-guard (default-deny крос-тенант) + структурні хелпери `apps/api/src/auth/tenant.ts` (`requireActiveAgency`/`tenantWhere`/`tenantData`/`assertSameTenant`).
- Per-agency налаштування (templates/smtp/branding/referral/audit) keyed by `agencyId`.
- Storage: tenant-prefixed ключі `agencies/<agencyId>/...` (S2).
- Outbox + audit несуть `agencyId`.

> Висновок: **ізоляція даних між тенантами вже гарантована на рівні застосунку.** Далі — підсилити (RLS) і доскласти SaaS-обвʼязку.

---

## 3. Що отримує НОВА агенція, коли приходить на SaaS

Коли зовнішня агенція реєструється, потрібен **provisioning** — атомарне створення тенанта з усім дефолтним обвʼязком. Це майбутній `POST /saas/agencies/register`, але **функцію `provisionAgency()` закладаємо у фундамент зараз** (її вже викликає seed; Phase-1 signup просто перевикористає).

`provisionAgency({ agencyName, slug, ownerEmail, ownerName, plan })` в одній транзакції:

1. `Agency` (name, slug, **subdomain=slug**, **planId=null** (план із каталогу `BillingPlan` за потреби), **subscriptionStatus=active** (default; `trialing` лише при старті trial), **trialEndsAt=+14д при trial**).
2. `Profile` власника (або привʼязка існуючого) + `AgencyMember{role: owner}`.
3. Дефолтні per-agency налаштування: `notification_templates` (копія системних), `smtp_senders` (workflo-дефолт, поки агенція не задасть свій), `pdf_branding` (дефолт-лого), `referral_settings`, базовий `department` («Загальний»).
4. `UsageCounter` рядки для періоду (orders/storage/seats = 0).
5. Welcome-нотифікація + (Phase 1) старт trial-підписки в Stripe.

**Per-tenant налаштування, які SaaS-агенція бачить у себе в адмінці** (усе вже scoped по `agencyId`, лишається UI — модуль 20):

- Бренд: лого, кольори, email-from, **subdomain** (`acme.workflo.space`) / custom domain.
- Команда: запросити виконавців (`AgencyMember`), ролі/права.
- Білінг агенції зі своїми клієнтами: способи оплати, валюта, реквізити для актів.
- Підписка агенції на workflo: план, ліміти, рахунки (Phase 1).
- Шаблони сповіщень, SMTP-сендер, нумерація документів — per-agency.
- API-ключі + webhooks (модуль 20, пізніше).

---

## 4. Foundation — закласти ЗАРАЗ (дешево, ретрофіт дорогий)

Це невеликий структурний набір. Рекомендований порядок — окремий блок **«S2-FDN: SaaS Foundation»** (паралельно/після S2-коду), щоб не чіпати потім живу мультитенантну БД.

### F1. SaaS-поля на `Agency` (nullable forward-compat міграція)

Додати зараз як nullable/defaulted (не використовуються до Phase 1, але потім не доведеться мігрувати живу таблицю тенантів):

```prisma
model Agency {
  // ...наявні поля...
  subdomain          String?                  @unique  // acme.workflo.space
  customDomain       String?                  @unique  // app.acme.com (Phase 1)
  planId             String?                            // → BillingPlan-каталог (НЕ enum)
  plan               BillingPlan?             @relation(fields: [planId], references: [id], onDelete: SetNull)
  subscriptionStatus AgencySubscriptionStatus @default(active) // trialing|active|past_due|canceled|suspended
  trialEndsAt        DateTime?                @db.Timestamptz(3)
  billingCustomerId  String?                            // Stripe customer id
  suspendedAt        DateTime?                @db.Timestamptz(3)
  limits             Json?                              // override планових лімітів
}
// План — це рядок каталогу BillingPlan (FK planId), не enum.
enum AgencySubscriptionStatus { trialing active past_due canceled suspended }
```

### F2. Quota / Feature seam (no-op зараз, чокпойнт потім)

Один хелпер-seam, вставлений у create-ендпоінти ЗАРАЗ (orders.create, members.invite, files.upload), щоб увімкнути ліміти потім — однією зміною, а не правкою 20 хендлерів:

```typescript
// apps/api/src/saas/limits.ts (Foundation: завжди allow; Enablement: реальні ліміти)
export async function assertWithinQuota(
  agencyId: string,
  resource: 'orders' | 'seats' | 'storage',
  delta = 1
): Promise<void> {
  // Phase 0: no-op (allow). Phase 1: звірити UsageCounter vs PLAN_LIMITS[plan][resource].
}
export async function featureEnabled(agencyId: string, flag: string): Promise<boolean> {
  // Phase 0: true. Phase 1: per-agency AgencyFeatureFlag + план.
  return true
}
```

### F3. `provisionAgency()` — фабрика тенанта (див. §3)

Винести створення Agency+owner+defaults у одну сервіс-функцію зараз (викликає seed). Phase-1 signup = тонкий ендпоінт над нею.

### F4. RLS-конвенція (Row-Level Security) — **головне рішення**

**Рекомендація:** shared-DB + app-level scoping (як зараз) **+ Postgres RLS як другий рубіж** перед першим зовнішнім тенантом. Закласти **конвенцію** зараз (дешево), вмикати політики per-table.

Чому: зараз від крос-тенант-витоку рятують структурні хелпери (`tenantWhere`/`assertSameTenant`). RLS дає **гарантію на рівні БД** — навіть забутий `where agencyId` фізично не поверне чужі рядки. Для зовнішніх платних тенантів це must-have (belt-and-suspenders).

Конвенція (закласти у фундамент, вмикати поступово):

```sql
-- на кожній tenant-таблиці:
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING ("agencyId" = current_setting('app.current_agency_id', true));
```

Інтеграція з Prisma (ціна — усвідомлена): RLS вимагає `SET LOCAL app.current_agency_id` на кожен запит у межах транзакції. Реалізація — **Prisma Client Extension**, що обгортає запити в interactive-tx із `SET LOCAL` із сесійного `activeAgencyId`. Закласти extension-seam зараз (порожній), політики додавати по таблиці.

> Альтернативи (задокументовано, відкладено): **schema-per-tenant** / **DB-per-tenant** — переглянути на 100+ тенантах або вимозі фізичної ізоляції (вже у ADR-004 §Перегляд). Для старту shared-DB+RLS — стандартний прагматичний вибір.

### F5. Tenant-aware rate-limit + інфра-seam

- `@fastify/rate-limit` `keyGenerator` включає `agencyId` (де є сесія) → per-tenant ліміти потім = конфіг. (Auth-ліміти лишаються per-IP.)
- `BASE_DOMAIN` env (для subdomain-резолву) + Traefik wildcard `*.workflo.space` — **інфра-рішення, дешево зафіксувати в S0-доках зараз**, навіть якщо subdomain-роутинг вмикаємо потім.
- Host→tenant resolver seam (subdomain → `Agency.subdomain`) — стаб зараз, реальний резолв у Phase 1.

### F6. Кожна НОВА таблиця (S2–S8) несе `agencyId` з дня 1

Не нова робота — підтвердження принципу: жодна tenant-таблиця не зʼявляється без `agencyId` + RLS-політики. Це вже діє (orders/comments/files/time_logs з S2 несуть `agencyId`).

---

## 5. Enablement — зробити В КІНЦІ (Phase 1, окремий пізній спрінт)

Усе нижче — поверх готової схеми, **без міграції даних**, тому безпечно наприкінці:

- **E1. Agency signup + onboarding wizard** — `POST /saas/agencies/register` (над `provisionAgency()`) + майстер: бренд → запросити команду → перший клієнт.
- **E2. SaaS-підписка** — біллінг агенції за workflo: `Plan`/`Subscription`, Stripe Checkout + Customer Portal, trial→active, dunning (past_due → read-only), рахунки. (Окремо від клієнтського біллінгу модуля 05 — там клієнт платить агенції.)
- **E3. Per-domain branding у рантаймі** — subdomain/custom domain → завантаження бренду тенанта; SSL для custom domain.
- **E4. Quota enforcement (значення)** — `PLAN_LIMITS` + `UsageCounter` метрика + upgrade-prompts; вмикається в seam F2.
- **E5. Super-admin (платформа)** — список агенцій, suspend/resume, impersonate, платформні метрики, cost→P&L.
- **E6. Lifecycle тенанта** — suspension (read-only), експорт даних (GDPR), видалення тенанта + його блобів.
- **E7. AgencyFeatureFlag / ApiKey / WebhookEndpoint** — модуль 20 (могло б і раніше, але не блокує).

---

## 6. Аналіз S0 / S1 / S2 — що несе кожен (відповідь на запит)

> S0/S1 уже закриті кодом; нижче — що вони **вже несуть** (✅) і що варто **доскласти** як невеликий backfill (структурне, дешеве). S2 — у роботі, тому seam'и вставляємо в нього.

### S0 — Foundation infra (закрито)

- ✅ Монорепо/CI/Hetzner/Postgres16/Traefik.
- ➕ **Доскласти в S0-доках (інфра-рішення, без коду):** `BASE_DOMAIN` env + Traefik **wildcard `*.workflo.space`** (щоб subdomain-тенанти не вимагали зміни інфри потім); плейсхолдери env під Stripe; примітка, що Postgres-міграції пишемо RLS-сумісно.

### S1 — Auth + Tenancy (закрито, S1.6)

- ✅ Agency + AgencyMember + agencyId + JWT `activeAgencyId` + `can()` tenant-guard + `tenant.ts`.
- ➕ **Доскласти (малий backfill, до/під час S2):** SaaS-поля `Agency` (F1, nullable) + `provisionAgency()` (F3, рефактор seed) + RLS-extension seam (F4) + tenant-context middleware (ставить `app.current_agency_id`). Усе структурне — дешевше зараз, ніж на живій мультитенантній БД.

### S2 — Orders/Chat/Files API (у роботі)

- ✅ Усі ендпоінти tenant-scoped (`requireOrderParticipant`/`requireTeamOrder`/`assertSameTenant`); storage tenant-prefixed; activity/outbox несуть `agencyId`.
- ➕ **Вставити seam'и зараз:** `assertWithinQuota()` у `orders.create` + `files.upload` + (S5) `members.invite` (F2, no-op); RLS-політики на нові S2-таблиці (orders, order_comments, order_files, time_logs, internal_tasks, activity_logs); tenant-aware rate-limit key (F5).

**Підсумок аналізу:** «закласти під SaaS на S0-S2» = **F1–F6** (один невеликий структурний блок). Усе інше (signup/біллінг/branding/super-admin) — Enablement у кінці. Жодного переписування.

---

## 7. Відкриті рішення (зафіксувати перед Phase 1, не зараз)

- **Білінг-провайдер SaaS-підписки:** Stripe (гнучко, але податки самі) vs Paddle/LemonSqueezy (merchant-of-record, простіший VAT для глобального продажу). Рекомендація: оцінити Paddle/LMSQ як MoR для України→глобал.
- ✅ **White-label-модель (вирішено 1.06):** кожна агенція = власний брендований **лендинг + портал + воркспейс**. Функції/логіка/екрани конфігурування — у [`SAAS_CONFIG.md`](SAAS_CONFIG.md). Ключове: бренд = `--wf-*` токени, що інжектяться у рантаймі → фронтенд будуємо на токенах + host→tenant resolution seam (інакше ретрофіт дорогий).
- **Domain-стратегія:** subdomain (`*.workflo.space`, просто) на старті; custom domain (`app.acme.com`, SSL-провіжн) — пізніше.
- **Глибина ізоляції:** shared-DB+RLS (старт) → schema/DB-per-tenant (якщо enterprise-тенант вимагатиме фізичну ізоляцію).
- **Pricing/packaging** (free/starter/pro/business, ліміти) — продуктове, до Phase 1.

---

## 8. Чек-лист «готові продавати як SaaS»

- [ ] F1 SaaS-поля Agency (міграція, nullable)
- [ ] F2 quota/feature seam (no-op) у create-ендпоінтах
- [ ] F3 `provisionAgency()` (seed перевикористовує)
- [ ] F4 RLS-конвенція + Prisma-extension seam + політики на tenant-таблиці
- [ ] F5 tenant-aware rate-limit key + `BASE_DOMAIN` + wildcard subdomain (інфра)
- [ ] F6 (діє) кожна нова таблиця з `agencyId` + RLS
- [ ] E1–E7 (Phase 1, у кінці): signup, SaaS-підписка, branding-рантайм, quota-значення, super-admin, lifecycle, flags/api/webhooks

> Коли F1–F6 готові — запуск SaaS = реалізація E-блоку як окремого спрінта, **без ризику для даних**.
