# WORKFLO.SPACE — Концепція v3.0

> Статус: **ФІНАЛЬНА. Готова до технічного плану.**
> Дата: 12 квітня 2026
> Режим проекту (AGENTS.md): **Pro**

---

## СУТЬ ПРОЕКТУ

Workflo.space — цифровий офіс команди автоматизаторів. Бізнес знаходить рішення своїх проблем, переконується через кейси і отримує зручний інструмент для спільної роботи.

**Дві core концепції:**

1. Ми вирішуємо бізнес-проблеми (не продаємо технології)
2. Команда з досвідом, доведеним через кейси з конкретними цифрами

**Головний принцип:** клієнтоорієнтованість.

---

## МОДЕЛЬ АКТОРІВ

### Сторона виконавців:

```
owner        — повний доступ до всього. Може бути виконавцем.
executor     — бачить тільки призначені задачі. Без білінгу клієнтів.
```

Виконавці потрапляють в систему тільки через запрошення від owner (invite-link або ручне створення акаунту).

### Сторона клієнтів:

```
Company Owner  — повний доступ до задач компанії, білінг, запрошення членів,
                 підтвердження оцінок. Налаштовує права для своїх членів.

Company Member — дефолтні права (налаштовуються owner'ом):
  ✅ create_tasks          (за замовч.: так)
  ✅ view_all_company_tasks (за замовч.: так)
  ✅ comment_in_chat        (за замовч.: так)
  ❌ view_billing           (за замовч.: ні)
  ❌ approve_estimates      (за замовч.: ні)
  ❌ invite_members         (за замовч.: ні)
```

Клієнт при реєстрації автоматично стає Company Owner. Один користувач = одна компанія (поки що). Може запросити колег до своєї компанії.

---

## МОДЕЛЬ КОМПАНІЇ (WORKSPACE)

```sql
companies
  id, name, created_by (profiles.id),
  is_active, deactivated_at,
  created_at

company_members
  id, company_id, user_id,
  role (owner | member),
  -- Кастомні права (override дефолтів)
  can_create_tasks      (bool, default true)
  can_view_billing      (bool, default false)
  can_approve_estimates (bool, default false)
  can_invite_members    (bool, default false)
  invited_by, joined_at, is_active
```

Всі замовлення прив'язані до `company_id`, не до конкретного користувача. Будь-який активний member компанії бачить всі задачі компанії (якщо `can_view_all_tasks`).

---

## LIFECYCLE ЗАМОВЛЕННЯ

```
[draft]
   ↓
[submitted]       ← клієнт надіслав
   ↓
[under_review]    ← owner переглядає
   ↓
[estimated]       ← виставлена оцінка, клієнт отримав нотифікацію
   ↓
[approved]  ←── Company Owner або member з правом approve підтвердив
[declined]  ←── відхилив → revision або закриття
   ↓
[in_progress]
   ↓
[review]          ← передано клієнту на перевірку
   ↓
[completed] ←── клієнт прийняв (або revision → in_progress)
   ↓
[paid]            ← оплата зафіксована
```

### Подвійний статус:

Кожне замовлення має два статуси:

```
internal_status  →  що бачить команда (детальний)
client_status    →  що бачить клієнт (спрощений)
```

**Client statuses (4, незмінні):**

- Нова заявка / New request
- В роботі / In progress
- На перевірці / Under review
- Завершено / Completed

**Internal statuses (фіксовані в MVP):**

| Internal        | → Client     |
| --------------- | ------------ |
| new             | Нова заявка  |
| assigned        | Нова заявка  |
| in_progress     | В роботі     |
| stuck           | В роботі     |
| internal_review | В роботі     |
| testing         | На перевірці |
| delivered       | На перевірці |
| revision        | В роботі     |
| closed          | Завершено    |

Owner може вручну перевизначити `client_status` незалежно від внутрішнього.

### Два типи задач:

```
client_order    — прив'язана до компанії-клієнта, оплачується
                  проходить повний lifecycle, видно клієнту

internal_task   — без клієнта, не оплачується
                  спрощений kanban, тільки для команди
                  приклади: оновлення сервера, бекап, внутрішня розробка
```

---

## KANBAN

**Для команди (внутрішній):** всі задачі (client_order + internal_task) по `internal_status`. Drag & drop між колонками.

**Для клієнта:** спрощений вигляд тільки своїх задач по `client_status`. Не kanban, а список з badge статусу.

---

## ФІНАНСОВА МОДЕЛЬ

### Білінг клієнтів — 2 моделі:

**1. Разова оплата (fixed price)**
Замовлення → оцінка → погодження → робота → підтвердження → оплата.

**2. Recurring послуга**
Послуга в каталозі має базову ціну. При призначенні клієнту — ціна індивідуальна. Один клієнт може мати кілька різних recurring послуг одночасно.

```
Клієнт А:
  → Обслуговування сервера   $65/міс   (5-го числа)
  → Технічна підтримка      $100/міс   (1-го числа)
```

Система щомісяця генерує `service_charges`. Власник підтверджує оплату вручну (MVP). Stripe — Phase 2.

### Billing type для замовлення:

```
billing_type:
  fixed   — фіксована сума, час не рахується
  hourly  — ставка клієнта × фактичні години
```

Ставка прив'язана до компанії-клієнта (`default_hourly_rate_usd`). При конкретному замовленні можна перевизначити.

### Time tracking:

Виконавець вручну вносить час (start/end або просто хвилини) з коментарем що робив. При `billing_type=hourly` — `total_hours × client_rate = client_amount`.

Клієнт може бачити деталізацію по годинах (налаштовується власником per order).

Для власника: ефективність команди, хто скільки витрачає часу на задачі.

### Аванс і фінальна вартість:

При частковій передоплаті (аванс) — фінальний баланс розраховується автоматично:

```
Приклад:
  order.totalAmount   = $1000   ← встановлює owner після завершення
  advance payments    = $300    ← підтверджений аванс, прив'язаний до замовлення
  balance_due         = $700    ← клієнт бачить у portal

При balance_due = 0 → order.paidAt встановлюється автоматично
```

Клієнт у portal бачить: `Сума: $1000 | Аванс: $300 | До оплати: $700`

Авансовий рахунок (`advance_invoice`) може виставлятися до початку роботи. При підтвердженні оплати — `Payment { type: advance, orderId }` — борг зменшується одразу.

### Валюта та відображення:

Суми зберігаються в **базовій валюті** (USD за замовчуванням). Курс UAH задає власник вручну в `/settings`. Скрізь в UI показуються **обидва значення** одночасно.

```
Відображення:   $500 / ₴20,750
Рахунок PDF:    500 USD за курсом 41.50 = 20,750.00 UAH
```

```
ExchangeRate (singleton в БД):
  usdToUah  = 41.50   ← власник оновлює вручну
  eurToUah  = 45.20
  updatedAt, updatedBy

PaymentSettings:
  invoiceCurrency = "UAH"  ← дефолт для PDF рахунків, можна змінити на USD/EUR
```

**Timezone:** БД зберігає UTC. Workspace показує час за Києвом (`Europe/Kiev`). Portal показує в timezone браузера клієнта; дедлайни дублюються: `31 грудня 23:59 (ваш час) / 01:59 Kyiv`.

### Провайдери оплати (адаптер паттерн):

```
ManualProvider (MVP)   — owner підтверджує вручну, без онлайн-оплати
LiqPayProvider         — Phase 2, Ukrainian acquiring
StripeProvider         — Phase 2, міжнародні картки
MonobankProvider       — Phase 2, Monobank acquiring
```

Єдиний `PaymentProvider` інтерфейс: `createPaymentLink()` + `handleWebhook()` + `verifySignature()`. Додавання нового провайдера = новий файл, без змін в існуючому коді.

При підтвердженні оплати фіксується:

```
provider:          manual | liqpay | stripe | monobank
provider_payment_id: ID транзакції в провайдері (якщо є)
payment_link:      URL для оплати (якщо є)
payment_method:    bank_transfer | card | crypto | cash | other
payment_reference: номер переказу або txid
```

### Спосіб оплати:

При підтвердженні оплати фіксується:

```
payment_method: bank_transfer | cash | crypto | freelance_platform | other
payment_reference: номер транзакції або ID на біржі
platform_name: Freelancehunt | Upwork | ... (якщо freelance_platform)
external_order_link: посилання на задачу на біржі
```

### Виплати команді:

```
executor_rates:
  monthly_salary_usd     — фіксована місячна ставка (nullable)
  commission_type        — none | percent | fixed_per_order
  commission_value       — % або фіксована сума
  hourly_rate_usd        — погодинна ставка виконавця (nullable)
  effective_from/to      — з якої дати діє (зберігає історію)
```

Пріоритет: ручний `executor_amount` на замовленні → автоматичний розрахунок з ставки.

---

## РЕФЕРАЛЬНА СИСТЕМА

- Кожна компанія-клієнт отримує унікальне посилання: `workflo.space?ref=CODE`
- Реєстрація за посиланням → фіксується зв'язок
- При кожній оплаті реферала → реферер отримує % на бонусний баланс

**Прогресивна ставка:**

```
$0–200 зароблено   → 10%
$200–500           → 12%
$500+              → 15%
```

Бонусний баланс = знижка на власні замовлення (не кеш).

---

## LOYALTY СИСТЕМА

```
New     до $500      —  без знижки
Regular $500–$2,000  →  5%
Partner $2,000–$5,000→  10%
VIP     $5,000+      →  15%
```

Тир підвищується автоматично. Owner може перевизначити вручну. Phase 3: пріоритет, виділений виконавець.

---

## НОТИФІКАЦІЇ

### Автоматичні (тригер → система → клієнт):

- Зміна статусу замовлення
- Нове повідомлення в чаті
- Виставлена оцінка (потрібне підтвердження)
- Підтвердження оплати
- Нарахування по recurring послузі
- Нотифікація виконавцю при призначенні задачі

### Ручні (від owner):

- Вибір клієнта → шаблон або довільний текст → email / Telegram / обидва
- Шаблони: нагадування про оплату, підтвердження, тощо

### Клієнт налаштовує:

- Email ✓/✗, Telegram ✓/✗ (per тип події)
- Phase 3: SMS ✓/✗

### Канали нотифікацій (адаптер паттерн):

```
MVP:      Email + Telegram
Phase 3:  SMS (Twilio або українські провайдери)
Future:   Push notifications (мобільний застосунок)
```

Нові канали = новий adapter у `packages/notifications`, нові поля в `NotificationSettings`. Існуючий код не змінюється.

### OTP — гнучка система:

OTP можуть надходити по різних каналах (окрема таблиця `otp_tokens`):

```
purpose:  telegram_link | two_fa | phone_verify | email_verify
channel:  email (MVP) → telegram → sms (Phase 3)
```

Telegram bot:

- Окремий сервіс для push-нотифікацій
- Клієнт прив'язує акаунт через `/start {OTP код}` з порталу
- Phase 3: інтерактивні команди (`/status`, `/tasks`)

---

## ТЕХНІЧНИЙ СТЕК (фінальний)

| Компонент           | Рішення                                                            |
| ------------------- | ------------------------------------------------------------------ |
| Landing             | Next.js 15 (App Router, SSR/ISR)                                   |
| Portal              | React 18 + Vite SPA                                                |
| API                 | Node.js + Fastify                                                  |
| Bot                 | grammY                                                             |
| DB                  | PostgreSQL (Docker)                                                |
| ORM                 | Prisma                                                             |
| Email (нотифікації) | Nodemailer + Mailcow                                               |
| Корпоративна пошта  | Mailcow на Hetzner                                                 |
| Files               | /uploads локально + nginx (MVP) → Hetzner Object Storage (Phase 2) |
| Realtime чат        | SSE + PostgreSQL LISTEN/NOTIFY                                     |
| Cron jobs           | pg_cron (recurring charges, archiving)                             |
| Hosting             | Hetzner (власний сервер)                                           |
| Proxy               | Traefik (вже є)                                                    |
| CI/CD               | GitHub Actions → SSH → docker compose                              |
| Монорепо            | Turborepo + pnpm                                                   |
| Analytics           | Plausible або Google Analytics 4                                   |
| Error monitoring    | Sentry (free tier)                                                 |
| Курс валют          | НБУ API                                                            |
| OG images           | Next.js ImageResponse (автогенерація)                              |

**Email адреси:**

- `hello@workflo.space` — загальний контакт на лендінгу
- `support@workflo.space` — підтримка клієнтів
- `noreply@workflo.space` — автоматичні листи
- `name@workflo.space` — особисті для команди (5 осіб)

---

## ПОВНА СХЕМА БД

```sql
-- ═══════════════════════════════
-- КОРИСТУВАЧІ
-- ═══════════════════════════════

profiles
  id (uuid, pk), email (unique), password_hash,
  full_name, avatar_url, phone,
  role (owner | executor | client),
  telegram_id (bigint, unique, nullable),
  locale (uk | en),
  is_active, deactivated_at,
  reset_token, reset_token_expires_at,
  created_at, updated_at

-- ═══════════════════════════════
-- КОМПАНІЇ КЛІЄНТІВ
-- ═══════════════════════════════

companies
  id, name, created_by (→ profiles.id),
  default_hourly_rate_usd (nullable),
  is_active, deactivated_at, created_at

company_members
  id, company_id (→ companies.id),
  user_id (→ profiles.id),
  role (owner | member),
  can_create_tasks      (bool, default true),
  can_view_billing      (bool, default false),
  can_approve_estimates (bool, default false),
  can_invite_members    (bool, default false),
  invited_by (→ profiles.id),
  joined_at, is_active

-- ═══════════════════════════════
-- LOYALTY І БОНУСИ
-- ═══════════════════════════════

company_loyalty
  company_id (pk), tier (new|regular|partner|vip),
  total_spent_usd, discount_percent,
  manually_overridden (bool), override_reason, updated_at

bonus_balance
  company_id (pk), balance_usd,
  total_earned_usd, total_used_usd, updated_at

referrals
  id, referrer_company_id, referee_company_id,
  status (pending | qualified | rewarded),
  order_id (nullable),
  reward_percent, reward_amount_usd,
  created_at, rewarded_at

-- ═══════════════════════════════
-- КАТАЛОГ І ПІДПИСКИ
-- ═══════════════════════════════

services
  id, name_uk, name_en,
  description_uk, description_en,
  billing_cycle (monthly | quarterly | yearly),
  default_price_usd, is_active

client_services
  id, company_id, service_id,
  custom_price_usd,
  billing_day (1–28),
  start_date, status (active | paused | cancelled),
  next_billing_date, notes

service_charges
  id, client_service_id, company_id,
  amount_usd, uah_rate,
  billing_period,
  status (pending | paid | overdue),
  due_date, paid_at, notes

-- ═══════════════════════════════
-- ЗАМОВЛЕННЯ
-- ═══════════════════════════════

order_internal_statuses
  id, code, label_uk, label_en,
  maps_to_client_status,
  color, sort_order, is_system (bool)

orders
  id, company_id (→ companies.id),
  created_by (→ profiles.id),
  executor_id (→ profiles.id, nullable),
  service_id (nullable),
  task_type (client_order | internal_task),
  title, description,
  internal_status_id (→ order_internal_statuses.id),
  client_status (new|in_progress|review|completed),
  priority (low | normal | high | urgent),
  billing_type (fixed | hourly),
  hourly_rate_usd (nullable),
  total_hours (nullable),
  client_amount_usd (nullable),
  currency (usd | uah), uah_rate (nullable),
  payment_status (pending | partial | paid),
  payment_method (bank_transfer|cash|crypto|freelance_platform|other, nullable),
  payment_reference (nullable),
  platform_name (nullable),
  external_order_link (nullable),
  discount_applied_percent,
  bonus_used_usd,
  show_hours_to_client (bool, default false),
  due_date, completed_at, paid_at,
  archived_at (nullable),
  created_at, updated_at

order_executor_finance
  order_id (pk), executor_id,
  executor_amount_usd (nullable — якщо null, рахується з ставки),
  paid_to_executor (bool), paid_at

order_stages
  id, order_id, title, description,
  executor_id (nullable),
  client_amount_usd, executor_amount_usd,
  status (pending|in_progress|done|approved|paid),
  due_date, approved_at, paid_at, sort_order

time_logs
  id, order_id, stage_id (nullable),
  executor_id,
  started_at, ended_at, minutes,
  description, created_at

order_files
  id, order_id, stage_id (nullable),
  uploader_id, file_name, file_size,
  file_path, created_at

order_comments
  id, order_id, author_id,
  content, is_internal (bool),
  created_at

order_activity
  id, order_id, actor_id, actor_role,
  action, old_value (jsonb), new_value (jsonb),
  is_public (bool), created_at

-- ═══════════════════════════════
-- ВИКОНАВЦІ
-- ═══════════════════════════════

executor_rates
  id, executor_id,
  monthly_salary_usd (nullable),
  hourly_rate_usd (nullable),
  commission_type (none | percent | fixed_per_order),
  commission_value,
  effective_from, effective_to (nullable)

executor_payouts
  id, executor_id, period,
  salary_usd, commission_usd, total_usd,
  status (pending | paid),
  paid_at, notes

-- ═══════════════════════════════
-- НОТИФІКАЦІЇ
-- ═══════════════════════════════

notification_settings
  user_id (pk),
  email_enabled (bool, default true),
  telegram_enabled (bool, default false),
  notify_status_change (bool, default true),
  notify_new_message (bool, default true),
  notify_billing (bool, default true)

message_templates
  id, name, subject_uk, subject_en,
  body_uk, body_en,
  type (payment_reminder | order_confirmation | custom)

notification_log
  id, user_id, channel (email | telegram),
  type, payload (jsonb),
  sent_at, status (sent | failed)

-- ═══════════════════════════════
-- КОНТЕНТ
-- ═══════════════════════════════

blog_posts
  id, slug (unique),
  type (article | case_study),
  title_uk, title_en,
  excerpt_uk, excerpt_en,
  content_uk, content_en,
  tags[], author_id,
  published (bool), featured (bool),
  published_at, archived_at,
  seo_title_uk, seo_title_en,
  seo_description_uk, seo_description_en,
  cover_image_path, created_at

-- ═══════════════════════════════
-- ІНШЕ
-- ═══════════════════════════════

contact_requests
  id, name, email, phone,
  message, source (landing_form | telegram),
  status (new | responded | converted),
  converted_to_company_id (nullable), created_at

invite_tokens
  id, token (unique), role (executor | client),
  created_by, used_by (nullable),
  expires_at, used_at
```

---

## АРХІТЕКТУРА ПРОЕКТУ

```
workflo.space/                    ← Монорепо (Turborepo + pnpm)
├── apps/
│   ├── landing/                  ← Next.js 15 — workflo.space
│   ├── portal/                   ← React 18 + Vite — portal.workflo.space (клієнти)
│   ├── workspace/                ← React 18 + Vite — work.workflo.space (команда)
│   ├── api/                      ← Node.js Fastify — api.workflo.space
│   └── bot/                      ← Telegram bot (grammY)
└── packages/
    ├── ui/                       ← Shared компоненти, CatMascot, design tokens
    ├── db/                       ← Prisma schema + client + migrations
    ├── types/                    ← Shared TypeScript types
    └── notifications/            ← Shared notification logic
```

**Розподіл по доменах:**

| App       | Домен                | Аудиторія                      |
| --------- | -------------------- | ------------------------------ |
| landing   | workflo.space        | Всі відвідувачі, SEO           |
| portal    | portal.workflo.space | Клієнти (компанії)             |
| workspace | work.workflo.space   | Команда (owner + executors)    |
| api       | api.workflo.space    | Backend для portal і workspace |
| bot       | —                    | Telegram нотифікації           |

**Ізоляція workspace:**
`work.workflo.space` закритий на рівні Traefik — IP whitelist для команди.
Клієнт фізично не може відкрити навіть якщо знає URL.

**Спільний код через packages:**

```
packages/ui            ← portal і workspace мають однаковий дизайн
packages/db            ← один Prisma client для api
packages/types         ← Order, Company, User — спільні типи
packages/notifications ← логіка email + Telegram
```

**Docker Compose сервіси:**

```
traefik     — reverse proxy + SSL (вже є на сервері)
postgres    — PostgreSQL 16
landing     — Next.js (workflo.space)
portal      — React SPA (portal.workflo.space)
workspace   — React SPA (work.workflo.space)
api         — Fastify (api.workflo.space)
bot         — Telegram bot
mailcow     — Email server (mail.workflo.space)
```

**Середовища:**

- `main` → production
- `dev` → staging (dev.workflo.space, dev-portal.workflo.space, dev-work.workflo.space)
- Окрема PostgreSQL БД для staging

**CI/CD:** GitHub Actions → Docker build → push to ghcr.io → SSH → docker compose pull → up

---

## ЛЕНДІНГ — СТРУКТУРА СТОРІНОК

**Головна (/):**
Hero → Проблеми які вирішуємо → Як працюємо (3 кроки) → Кейси → Команда → Моделі роботи → Telegram канал → FAQ → CTA

**Окремі сторінки:**

- `/cases` + `/cases/[slug]` — кейси з SEO
- `/blog` + `/blog/[slug]` — статті
- `/team` — команда (5 осіб)
- `/stack` — технології
- `/status` — статус системи (maintenance page)
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy

**SEO:** metadata, sitemap, hreflang (uk/en), schema markup (Person, FAQPage, Article), OG images автогенерація.

---

## BLOG І КОНТЕНТ — ПАЙПЛАЙН

### Типи контенту:

- `article` — стаття в блозі (поради, думки, автоматизація)
- `case_study` — кейс виконаної роботи (проблема → рішення → результат)

Обидва типи — двомовні (UA + EN), SEO-оптимізовані, рендеряться через ISR в Next.js.

### Як публікується контент (workspace → лендінг):

```
Власник → /content/new у Workspace
  ↓
Вводить prompt: "Кейс: автоматизація CRM для будівельної компанії, 1500 слів, UA"
  ↓
POST /workspace/content/ai-generate → OpenAI API (system prompt з SEO правилами)
  ↓
Повертає: { title, excerpt, content (Markdown), tags, slug }
  ↓
Власник бачить preview → може редагувати в textarea або натиснути "Регенерувати"
  ↓
"Опублікувати" → published: true → Next.js ISR revalidatePath('/blog')
  ↓
Сторінка оновлюється без rebuild
```

**Ключове рішення:** контент зберігається як **Markdown** (не TipTap JSON).

- AI генерує Markdown → простий формат, легко читати і редагувати вручну
- На лендінгу рендериться через `react-markdown` → HTML
- Можна регенерувати будь-коли з тим самим або новим prompt
- Не потрібен складний rich text editor — простий `<textarea>` з preview

**AI System Prompt (SEO-орієнтований):**

```
Ти SEO-копірайтер. Генеруй статті у форматі Markdown:
- H1: заголовок з ключовим словом
- Вступ: ключове слово в першому реченні
- 4-6 H2 секцій з підзаголовками
- FAQ блок (мінімум 3 питання) для FAQ schema markup
- excerpt: 150-160 символів з ключовим словом
- Теги: 3-5 релевантних
Вимоги: LSI ключові слова, природний текст, без keyword stuffing.
```

### DB (blog_posts):

```
id, slug (unique), type (article | case_study),
title_uk, title_en,
excerpt_uk, excerpt_en,   ← для карток і OG (150-160 символів)
content_uk, content_en,   ← Markdown text (рендериться в HTML на лендінгу)
tags[],
author_id → profiles,
published (bool), featured (bool),
created_at, updated_at, published_at
```

### ISR стратегія:

- `/blog` і `/cases` — `revalidate: 3600` (фоново, якщо не тригерити вручну)
- При публікації/оновленні → On-demand revalidation через `revalidatePath`
- `/blog/[slug]` — генерується при першому відвідуванні, кешується

### SEO для кожної статті:

- `<title>` і `<meta description>` з title*\* і excerpt*\*
- `hreflang` між UA і EN версіями
- Schema markup: `Article` (blog) / `Article` + `HowTo` (case_study)
- OG image — автогенерація через `@vercel/og` (заголовок + логотип)

---

## СТРУКТУРА APPS

### portal.workflo.space — Portal (клієнти)

Чистий, мінімалістичний. Тільки те що потрібно клієнту.

```
/                   — redirect → /dashboard
/dashboard          — активні задачі, борг, loyalty, бонуси
/tasks              — список задач компанії
/tasks/new          — створити задачу
/tasks/[id]         — деталь: статус, етапи, чат, файли, activity log
/billing            — recurring послуги, нарахування, платежі
/referrals          — посилання, статистика, бонусний баланс
/loyalty            — tier, прогрес, знижки
/team               — члени компанії, запрошення, права
/settings           — профіль, пароль, мова, нотифікації, Telegram
```

### work.workflo.space — Workspace (команда)

Щільний, функціональний. Більше даних на екрані. Закритий для зовнішніх.

**Власник:**

```
/                   — overview: revenue, борги, активні задачі, команда
/orders             — всі замовлення (kanban + таблиця + пошук)
/orders/[id]        — деталь + повне управління
/clients            — список компаній
/clients/[id]       — картка клієнта: члени, задачі, білінг, нотатки
/billing            — recurring нарахування місяця
/billing/payouts    — виплати виконавцям
/services           — каталог recurring послуг (CRUD)
/team               — виконавці, ставки, завантаження
/content            — blog/кейси: AI генерація → публікація
/messages           — ручна відправка клієнтам + шаблони
/inbox              — форми зворотнього зв'язку з лендінгу
/settings           — реферальна програма, системні налаштування
```

**Виконавець (обмежений доступ):**

```
/                   — моє завантаження, дедлайни, заробіток місяця
/tasks              — мої задачі (kanban)
/tasks/[id]         — деталь + зміна статусу + internal коментарі
/profile            — мій профіль, моя винагорода по проектах
```

---

## MVP — ФІНАЛЬНА МЕЖА

### ✅ Входить в MVP:

**Лендінг:**

- Головна (всі секції, реальний контент)
- Blog + кейси (AI пайплайн)
- /cases, /blog, /team, /stack, /status, /terms, /privacy
- UA + EN повністю
- SEO + OG images + Analytics

**portal.workflo.space — Portal (клієнти):**

- Реєстрація (створює компанію) / логін / скидання пароля
- Запрошення членів компанії + налаштування їх прав
- Вітальний email після реєстрації
- Створення задачі (вільна форма)
- Список і деталь задачі (статус, етапи, чат SSE, файли, activity log)
- Підтвердження оцінки і прийняття роботи
- Баланс заборгованості компанії
- Recurring послуги (перегляд призначених, нарахування)
- Реферали, loyalty tier, бонусний баланс
- Нотифікації: email + Telegram
- Налаштування: профіль, пароль, мова, нотифікації, Telegram прив'язка
- Підтримка: кнопка "Написати в Telegram/email"

**work.workflo.space — Workspace (виконавець):**

- Логін через invite
- Kanban своїх задач по internal_status
- Деталь задачі + зміна статусу + internal коментарі
- Time tracking (ручний ввід)
- Профіль + своя винагорода по проектах

**work.workflo.space — Workspace (власник):**

- Всі замовлення (kanban + таблиця + пошук + фільтри)
- Повне управління замовленням + internal tasks
- Картки клієнтів (задачі, білінг, loyalty, нотатки)
- Recurring billing dashboard + виплати виконавцям
- Каталог послуг (CRUD)
- Виконавці (ставки, завантаження)
- Blog/кейси: AI генерація → публікація
- Ручна відправка повідомлень + шаблони
- Inbox форм з лендінгу
- Налаштування реферальної програми

**Інфраструктура:**

- Монорепо + Docker Compose + Traefik
- CI/CD: GitHub Actions → Hetzner
- Dev + prod середовища розділені
- Mailcow + корпоративна пошта
- pg_cron для recurring charges
- Щоденний автобекап PostgreSQL
- Sentry для error monitoring
- Maintenance page

### ❌ Не в MVP:

| Функція                              | Фаза    |
| ------------------------------------ | ------- |
| Stripe / LiqPay                      | Phase 2 |
| Invoice PDF                          | Phase 2 |
| 2FA (всі акаунти)                    | Phase 2 |
| Hetzner Object Storage               | Phase 2 |
| Кастомні internal статуси            | Phase 2 |
| Авто-шаблонні задачі (cron)          | Phase 2 |
| Telegram bot команди клієнта         | Phase 3 |
| Клієнтська аналітика / charts        | Phase 3 |
| VIP пріоритет і виділений виконавець | Phase 3 |
| Мобільний застосунок                 | Future  |

---

## ДОКУМЕНТИ

### Типи документів

| Тип                                    | Коли створюється         | На основі чого                      |
| -------------------------------------- | ------------------------ | ----------------------------------- |
| `contract` — Договір                   | При старті роботи        | Шаблон + дані клієнта + опис задачі |
| `advance_invoice` — Авансовий рахунок  | До початку (передоплата) | Оціночна сума задачі                |
| `invoice` — Рахунок-фактура            | Після завершення         | Фінальна сума (`totalAmount`)       |
| `completion_act` — Акт виконаних робіт | Після прийняття клієнтом | Задача + результат                  |
| `specification` — Специфікація         | На вимогу                | Вся інформація по задачі            |

### Workflow

```
Owner у workspace → /orders/:id → вкладка "Документи"
  → "Сформувати рахунок" / "Сформувати акт" / "Специфікація"
  → система генерує PDF через @react-pdf/renderer
  → PDF зберігається у /srv/uploads/documents/{id}.pdf
  → Owner: preview → "Надіслати клієнту"
  → клієнт отримує email з PDF + бачить у portal /orders/:id → "Документи"
```

### Нумерація

```
INV-2026-0001   ← invoice
ADV-2026-0001   ← advance_invoice
ACT-2026-0001   ← completion_act
SPEC-2026-0001  ← specification
CTR-2026-0001   ← contract
```

Лічильник по типу + рік (скидається 1 січня).

### Специфікація — особливий тип

Специфікація — не шаблонний документ, а повний зріз задачі:

```
СПЕЦИФІКАЦІЯ #SPEC-2026-0001
──────────────────────────────────────
Задача: {title}
Компанія: {company.name}
Виконавець: {assignee.name}
Період: {createdAt} — {completedAt}

ОПИС ЗАВДАННЯ:
{order.description}

КОМЕНТАРІ КОМАНДИ (внутрішні):
{order.comments.filter(isInternal).map(c => `[${c.createdAt}] ${c.author}: ${c.content}`)}

ЗАФІКСОВАНИЙ ЧАС:
{order.timeLogs.map(l => `${l.date} | ${l.hours}год | ${l.executor} | ${l.comment}`)}
Загалом: X год

ВАРТІСТЬ:
Тип білінгу: {billingType}
{if hourly: Ставка {hourlyRate}/год × {totalHours}год}
Підсумкова сума: ${totalAmount}
──────────────────────────────────────
```

### Доступ

- **Owner/Workspace** — повний CRUD: генерація, перегляд, відправка, видалення drafts
- **Клієнт/Portal** — тільки перегляд і завантаження документів зі статусом `sent`
- **Executor** — не бачить документів

### DB — documents table

```
documents:
  id, type (DocumentType), number (INV-2026-0001),
  order_id? → orders, company_id → companies,
  status (draft | generated | sent),
  stored_as (шлях до PDF або null),
  sent_at?, generated_at, created_by_id → profiles

document_counters:
  type (PK), count, year
```

### MVP межа

- ✅ Генерація invoice, completion_act, specification
- ✅ Відправка клієнту email з PDF
- ✅ Перегляд у portal
- 📌 Phase 2: contract з e-підписом, advance_invoice, кастомні шаблони

---

## МОВИ І ТЕМИ

### Мови — 2 скрізь (UA + EN)

**Правило:** кожен текст в системі існує в двох мовах. Немає виключень.

| App           | Бібліотека       | Стратегія                                   |
| ------------- | ---------------- | ------------------------------------------- |
| landing       | `next-intl`      | `/uk/...` і `/en/...`, дефолт `/uk/`        |
| portal        | `react-i18next`  | мова з `profile.language`, URL без префіксу |
| workspace     | `react-i18next`  | те саме                                     |
| API помилки   | custom           | `Accept-Language` або `profile.language`    |
| Email листи   | custom templates | `profile.language`                          |
| Telegram bot  | custom           | `profile.language`                          |
| PDF документи | custom           | `profile.language`                          |

**Переклади живуть у `packages/i18n`:**

```
packages/i18n/locales/
  uk/common.json, orders.json, billing.json, errors.json, documents.json
  en/common.json, orders.json, billing.json, errors.json, documents.json
```

Статуси замовлень, назви тиерів, типи документів — все перекладається через ці файли.

**Мова зберігається в `profile.language`** і змінюється в /settings.

---

### Теми — Light і Dark скрізь

**Правило:** всі 5 apps (landing, portal, workspace + bot не має UI) підтримують обидві теми.

**Реалізація: Tailwind `darkMode: 'class'` + CSS Variables**

```css
/* packages/ui/src/tokens/themes.css */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --accent: #2563eb;
}
.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --accent: #3b82f6;
}
```

3 варіанти для користувача: **Light | Dark | System** (слідує за ОС).

**Зберігання:**

- `localStorage` — миттєво, без flash при завантаженні
- `profile.theme` (light | dark | system) — sync між пристроями

**`ThemeProvider`** — спільний компонент у `packages/ui`, підключається в root кожного app.

---

## ФАЙЛОВЕ СХОВИЩЕ

### MVP → Phase 2 (адаптер паттерн)

Зберігання файлів реалізовано через абстрактний `StorageAdapter` — зміна провайдера без зміни коду бізнес-логіки:

```
MVP:      LocalStorageAdapter  → /srv/uploads/ (Docker Volume на сервері)
Phase 2:  HetznerStorageAdapter → Hetzner Object Storage (S3-compatible)
```

**Структура на диску / в Storage:**

```
orders/{order_id}/{uuid}_{original_name}.ext   ← файли задач
documents/{document_id}.pdf                    ← згенеровані PDF
```

**Міграція Local → Hetzner:**

1. `rclone sync /srv/uploads hetzner:workflo-uploads`
2. `STORAGE_ADAPTER=hetzner` в ENV → restart API
3. Через тиждень видаляємо локальні файли

### Бекапи

| Фаза    | Де зберігаються                              | Retention                  |
| ------- | -------------------------------------------- | -------------------------- |
| MVP     | `/srv/workflo/production/backups/` (сервер)  | 14 днів                    |
| Phase 2 | Hetzner Object Storage `workflo-backups/db/` | 90 днів (lifecycle policy) |

Phase 2: `rclone copy backup.sql.gz hetzner:workflo-backups/db/` в backup.sh.

---

## UX ПРИНЦИПИ

**Система проста, інформативна, інтуїтивна.** Конкретні правила:

### Feedback на кожну дію

- Кнопка при кліку → disabled + spinner (не можна натиснути двічі)
- Успіх → toast/notification "Збережено" (2-3 сек, зникає автоматично)
- **Помилка → ЗАВЖДИ видима в UI**: toast з причиною + кнопка знову активна
- Мережева помилка → "Немає зʼєднання, спробуйте ще раз" з кнопкою retry
- Валідаційна помилка форми → під кожним полем окремо (не тільки загальний toast)
- **Критична помилка** (500, timeout) → modal з текстом і кнопкою "Повторити"

### Деструктивні дії

- Завжди confirmation dialog: "Видалити замовлення 'Назва'? Це незворотньо."
- Червона кнопка "Видалити" тільки в confirmation, не в звичайному UI

### Loading states

- **Skeleton** замість spinner для списків і карток (менше "стрибків" layout)
- **Optimistic updates** для зміни статусу — показуємо результат одразу, відкочуємо при помилці

### Empty states

- Порожній список задач → ілюстрація/іконка + "Ще немає задач. Створити першу?" + CTA кнопка
- Не просто порожня таблиця

### Адаптивність (Responsive)

| App       | Пристрій                  | Пріоритет                                 |
| --------- | ------------------------- | ----------------------------------------- |
| Landing   | Mobile + Tablet + Desktop | Обов'язково, mobile-first (SEO)           |
| Portal    | Mobile + Tablet + Desktop | Обов'язково (клієнти заходять з телефону) |
| Workspace | Tablet + Desktop          | Desktop-first, мінімум для планшета       |

Брейкпоінти (Tailwind): `sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px

### Мова помилок

- API помилки — зрозумілою мовою, не технічні коди
- "Email вже використовується" а не "Unique constraint violation"
- Мовою `profile.language` або `Accept-Language` header
- **Всі серверні помилки** відображаються в UI (toast/popup/inline) — жодна помилка не "проковтується"

### Accessibility (мінімум)

- `aria-label` на іконочних кнопках
- Keyboard navigation для модальних вікон (Escape → закрити, Tab → фокус)
- Достатній контраст тексту (WCAG AA мінімум)

---

## ВОРОНКА УТРИМАННЯ

```
SEO + Blog/Кейси → Лендінг → Впізнає проблему
        ↓
Контакт (Telegram / форма) → Перший дотик
        ↓
Реєстрація → Вітальний email → Перша задача
        ↓
Прозоре виконання (статуси + чат + нотифікації)
        ↓
Завершення → Loyalty tier росте → Пропозиція наступного
        ↓
Recurring послуга → Щомісячний звичний платіж
        ↓
Реферальна програма → "Поділись — заробляй"
        ↓
Telegram канал між задачами → Залишається в контексті бренду
```

---

## S1 ALIGNMENT UPDATE (27 травня 2026)

Цей блок фіксує рішення, прийняті на pre-S1 + S1 фазі. Деталі — у відповідних `docs/modules/*` та `docs/adr/*`.

### Multi-company per profile

Один `profile` може володіти/бути членом **кількох компаній**. Власника визначаємо через `CompanyMember.role='owner'` (partial unique index), а НЕ через `Company.ownerId` (видалено в S1-00 migration).

Користувач у Portal перемикається між компаніями через company switcher; `activeCompanyId` зберігається у access-token claims. Деталі — `modules/01-auth.md → Multi-company`.

### Канонічна таблиця статусів (source of truth)

`packages/types/src/enums.ts` + `constants.ts.INTERNAL_TO_CLIENT_STATUS`:

| Internal (9)  | Client (4)       |
| ------------- | ---------------- |
| new           | in_progress      |
| clarification | in_progress      |
| estimating    | in_progress      |
| in_progress   | in_progress      |
| on_hold       | in_progress      |
| review        | pending_approval |
| revision      | in_progress      |
| done          | completed        |
| cancelled     | cancelled        |

**Зміни vs CONCEPT v2 baseline:**

- `estimated` → `estimating` (verb form, S1-03 migration).
- Видалено `approved` зі шкали (злито в transition estimating→in_progress).
- OrderClientStatus: `PENDING/IN_WORK/DONE` → `IN_PROGRESS/PENDING_APPROVAL/COMPLETED`.

### Loyalty: % знижка (не бали)

Замінено points/cashback на **% знижка за tier**: NEW(0%) / REGULAR(3%) / PARTNER(7%) / VIP(12%) за порогами 0/1k/5k/15k USD lifetime. Tier per company. Деталі — `modules/10-loyalty.md`.

### Notification matrix

7 категорій × 6 каналів × 27 events. MVP-канали: email/telegram/in_app. Критичні події (auth/billing) завжди йдуть на email (ADR-003). Деталі — `modules/07-notifications.md`.

### Нові модулі (post-MVP scope)

- **17-credentials**: сейф для credentials клієнтів (envelope encryption, owner-only).
- **18-chat-hub**: глобальний inbox замість per-order чатів.
- **19-reports**: time/revenue/debtors звіти для owner.
- **20-admin-settings**: templates editor, multi-SMTP, branding, nomenclature, departments, cron monitoring.
- **21-system-monitoring**: Sentry + dashboard + audit log.
- **22-finance-expenses**: облік витрат (recurring/one_time/ЗП) + P&L звіт (Дохід − Витрати = Прибуток). Фаза 1 — загальний P&L; Фаза 2 — маржа по клієнтах (cost allocation).

### Нові foundation docs

- **ADR 001/002/003**: cookie strategy / RBAC shim / channels MVP.
- **BACKLOG.md / LIFECYCLE.md / RETENTION.md**: capture buffer / state machines / retention policy.
- **DESIGN_BRIEF.md**: повне ТЗ для дизайнера.

### Time tracking

1 active timer per executor (global), auto-stop 8h, persistent у БД. Specification генерується з time_log коментарів при transition order→review. Деталі — `modules/02-orders.md → Time tracking`.

### Internal tasks + billing modes

Внутрішні задачі з billing mode: client_paid / internal_paid / unpaid. Departments = CRUD таблиця (не enum). Деталі — `modules/12-team-executors.md`.
