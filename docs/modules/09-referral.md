# MODULE 09 — REFERRAL SYSTEM

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Portal (`portal.workflo.space`) + Workspace (`work.workflo.space`)
> Статус: MVP
> Залежить від: [01-auth, 02-company, 05-billing, **25-wallet** (єдиний ledger-writer бонусів)]
> Оновлено: 1 червня 2026 (doc-sync)

---

## Огляд

Реферальна програма дозволяє компаніям-клієнтам залучати нових клієнтів в обмін на бонусний баланс. Кожна зареєстрована компанія отримує унікальний реферальний код формату `workflo-XXXXXX`. При реєстрації нового клієнта за реферальним посиланням система фіксує зв'язок. Після кожного підтвердження оплати реферованого клієнта система автоматично нараховує бонус на баланс реферера.

**MVP обмеження:**

- Глибина дерева = 1 (тільки прямі реферали, depth=1)
- Бонусний баланс відображається, але не може бути використаний для оплати (тільки в Phase 2)
- Відсоток прогресивний і залежить від загальної суми зароблених бонусів реферера

---

## Актори та доступ

| Актор                  | Доступ                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Company Owner (Portal) | Бачить своє реферальне посилання, QR-код, список залучених компаній, зароблені бонуси                 |
| Company Member         | Не має доступу до реферальної сторінки (це білінгова інформація)                                      |
| Owner (Workspace)      | Бачить реферальну статистику по всіх компаніях у `/settings/referral`, може вмикати/вимикати програму |
| Executor               | Немає доступу                                                                                         |

---

## Бізнес-логіка

### Генерація коду

Реферальний код генерується автоматично при реєстрації компанії. Формат: `workflo-XXXXXX`, де `XXXXXX` — 6 символів з алфавіту `A-Z0-9` (Base36 без малих літер).

```typescript
// apps/api/src/modules/company/company.service.ts
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const code = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `workflo-${code}`
}
// Приклад: workflo-K7X2QM
```

Унікальність гарантується constraint `UNIQUE` на полі `companies.referralCode`. При колізії (вкрай малоймовірно) — retry до 3 разів.

Посилання для поширення: `https://workflo.space?ref=workflo-K7X2QM`

### Реєстрація за реферальним посиланням

1. Користувач відкриває `https://workflo.space?ref=workflo-K7X2QM`
2. Landing зберігає `ref` параметр у `localStorage` (TTL 30 днів)
3. При переході на реєстрацію (`https://portal.workflo.space/register`) — Portal зчитує значення з `localStorage` і підставляє прихований `referralCode` у форму
4. `POST /auth/register { email, password, companyName, referralCode? }`:
   - Якщо `referralCode` передано → шукаємо компанію за `companies.referralCode`
   - Якщо знайдена → встановлюємо `newCompany.referredById = referrerCompany.id`
   - Якщо код не знайдено → реєстрація проходить без помилки (код просто ігнорується)
5. Запис у таблиці `referrals`:
   ```
   referrerId = referrerCompany.id
   referredId = newCompany.id
   totalEarned = 0
   createdAt = now()
   ```

### Прогресивна ставка бонусу

Ставка визначається за сумою вже зароблених бонусів реферером. **Канонічно (фіналізація-2 §A):** тіри живуть у `ReferralSettings.tiers` (per-agency, **редаговані** в адмінці, 5-хв кеш) — джерело істини. Хардкод-константа лишається лише **дефолтним сидом**:

```typescript
// packages/types/src/constants.ts — DEFAULT seed (НЕ source of truth)
export const DEFAULT_REFERRAL_TIERS = [
  { minEarned: 0, maxEarned: 499.99, percent: 10 },
  { minEarned: 500, maxEarned: 1999.99, percent: 12 },
  { minEarned: 2000, maxEarned: Infinity, percent: 15 },
] as const
```

`getReferralPercent()` читає `ReferralSettings.tiers` з БД (не константу). Ставка рахується на момент кожного нарахування.

### Нарахування бонусу при оплаті

Після підтвердження оплати реферованого клієнта нараховується бонус рефереру. **Канонічний шлях — через гаманець (модуль 25-wallet), а не прямий `increment bonusBalance`:**

- запис бонусу йде як `WalletTransaction` (credit, `source='referral_bonus'`) через **`walletCredit()`** — єдиний writer балансу;
- `Company.bonusBalance` — лише **кеш** (не пишемо в нього напряму);
- **ідемпотентність**: `UNIQUE(sourceType, sourceId)` на нарахуванні (повторний вебхук оплати не дублює бонус);
- ставка `percent` = `getReferralPercent(totalEarned)` з `ReferralSettings` (DB), `totalEarned` рахується через `referral`-зв'язок;
- усе в одній транзакції + `notify(event='referral.bonus_earned')` рефереру.

> ⚠️ **Застарілий `processReferralBonus` з прямим `prisma.company.update({ bonusBalance: { increment } })` та агрегацією по `ReferralBonus.referrerId` — видалено.** У реальній схемі `ReferralBonus` НЕ має колонок `referrerId`/`referredId` (лише `referralId`); єдиний шлях запису балансу — `walletCredit()`. Деталі — «## Аудит-оновлення» + «## Аудит-фіналізація-2 §A» нижче + модуль 25.

---

## DB

> **Канонічні моделі — `packages/db/prisma/schema.prisma`** (`Referral`, `ReferralBonus`, `ReferralSettings`, `Company` referral-поля). Ключові відмінності від стале-блоку, що був тут (фіналізація-2 §A):
>
> - `ReferralBonus` keyed **лише `referralId`** — НЕ має `referrerId`/`referredId`/`@relation("ReferrerBonuses")`; `percent Decimal(5,2)` (не `Int`); + **`UNIQUE(sourceType, sourceId)`** (ідемпотентність) + `agencyId`.
> - `Referral`: `@@unique([referrerId, referredId])`.
> - `Company.referralCode` — канонічний формат `workflo-XXXXXX` (⚠️ у схемі досі `@default(uuid())` — баг до фіксу; код-генератор авторитетний).
> - `bonusBalance` — кеш; істина балансу — `WalletTransaction` ledger (модуль 25).
> - Тіри — `ReferralSettings.tiers` (per-agency, редаговані).

**Implicit tree:** `Company.referredById` → пряме посилання на реферера; depth=2 (BACKLOG) — `WHERE referredById IN (SELECT id FROM companies WHERE referredById = $root)`, без змін схеми.

---

## API Endpoints

### Portal (клієнт)

```
GET /company/referral
```

Повертає реферальну інформацію поточної компанії.

**Response 200:**

```json
{
  "data": {
    "referralCode": "workflo-K7X2QM",
    "referralUrl": "https://workflo.space?ref=workflo-K7X2QM",
    "bonusBalance": "47.50",
    "totalEarned": "47.50",
    "currentPercent": 10,
    "nextTierAt": 500,
    "nextTierPercent": 12,
    "referredCompanies": [
      {
        "id": "uuid",
        "name": "ТОВ Ромашка",
        "joinedAt": "2026-03-15T10:00:00Z",
        "totalPaid": "475.00",
        "bonusEarned": "47.50"
      }
    ],
    "totalReferredCount": 1
  }
}
```

```
GET /bonus-balance
```

Поточний бонусний баланс (використовується також для відображення в header).

**Response 200:**

```json
{
  "data": {
    "bonusBalance": "47.50",
    "totalEarned": "47.50",
    "totalUsed": "0.00"
  }
}
```

### Workspace (owner)

```
GET /workspace/settings/referral
```

Поточні налаштування реферальної програми.

**Response 200:**

```json
{
  "data": {
    "enabled": true,
    "tiers": [
      { "minEarned": 0, "maxEarned": 499.99, "percent": 10 },
      { "minEarned": 500, "maxEarned": 1999.99, "percent": 12 },
      { "minEarned": 2000, "maxEarned": null, "percent": 15 }
    ],
    "totalReferredCompanies": 12,
    "totalBonusesPaid": "1240.50"
  }
}
```

```
PATCH /workspace/settings/referral
Body: { "enabled": false }
```

Вмикає або вимикає реферальну програму. Якщо вимкнено — нові реферали не фіксуються, але існуючі зв'язки залишаються.

```
GET /workspace/referrals
Query: ?page=1&perPage=20&search=
```

Список всіх реферальних зв'язків для аналітики.

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "referrer": { "id": "uuid", "name": "ФОП Петренко" },
      "referred": { "id": "uuid", "name": "ТОВ Ромашка" },
      "totalEarned": "47.50",
      "bonusesCount": 3,
      "createdAt": "2026-03-01T00:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "perPage": 20,
  "totalPages": 1
}
```

---

## UI Flows

### Portal — `/referrals`

```
┌─────────────────────────────────────────────────────┐
│  Реферальна програма                                 │
├─────────────────────────────────────────────────────┤
│  Ваше посилання:                                     │
│  [https://workflo.space?ref=workflo-K7X2QM] [Копія] │
│                                                      │
│  [QR-код 150×150px]                  [Завантажити]  │
│                                                      │
│  Поточна ставка: 10%                                 │
│  Зароблено: $47.50                                   │
│  Наступний рівень: 12% після $500 зароблених         │
│  [████████░░░░░░░░░░░░] $47.50 / $500               │
│                                                      │
│  Бонусний баланс: $47.50                             │
│  (буде доступний для оплати замовлень у Phase 2)     │
├─────────────────────────────────────────────────────┤
│  Залучені компанії (1)                               │
│  ┌──────────────────┬────────────┬────────────────┐ │
│  │ Компанія         │ Дата       │ Бонус зароблен │ │
│  ├──────────────────┼────────────┼────────────────┤ │
│  │ ТОВ Ромашка      │ 15.03.2026 │ $47.50         │ │
│  └──────────────────┴────────────┴────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**QR-код:** генерується на клієнті через бібліотеку `qrcode` (npm) з URL реферального посилання. Кнопка "Завантажити" зберігає PNG.

**Копія посилання:** `navigator.clipboard.writeText()` → toast "Посилання скопійовано".

### Workspace — `/settings/referral`

```
┌─────────────────────────────────────────────────────┐
│  Налаштування реферальної програми                   │
├─────────────────────────────────────────────────────┤
│  Статус програми:  [●] Увімкнено    [Вимкнути]      │
│                                                      │
│  Прогресивні ставки (редаговані — admin):            │
│  ┌─────────────────────────────┬──────────────────┐ │
│  │ Сума зароблених бонусів     │ Відсоток         │ │
│  ├─────────────────────────────┼──────────────────┤ │
│  │ $0 – $499                   │ 10%              │ │
│  │ $500 – $1,999               │ 12%              │ │
│  │ $2,000+                     │ 15%              │ │
│  └─────────────────────────────┴──────────────────┘ │
│                                                      │
│  Статистика:                                         │
│  Всього залучено компаній: 12                        │
│  Виплачено бонусів: $1,240.50                        │
└─────────────────────────────────────────────────────┘
```

---

## Notifications

| Подія                                        | Канал            | Отримувач               |
| -------------------------------------------- | ---------------- | ----------------------- |
| Реферований клієнт зареєструвався            | Email + Telegram | Реферер (Company Owner) |
| Нараховано бонус після оплати                | Email + Telegram | Реферер (Company Owner) |
| Досягнуто нового рівня ставки (10→12, 12→15) | Email + Telegram | Реферер (Company Owner) |

**Email шаблон — нарахування бонусу:**

```
Тема: Ви отримали реферальний бонус $47.50!

Вітаємо! Компанія "ТОВ Ромашка", яку ви залучили,
підтвердила оплату $475.00.
Ваш бонус (10%): $47.50 зараховано на бонусний баланс.

Поточний баланс: $47.50
Ваша сторінка рефералів: https://portal.workflo.space/referrals
```

**Email шаблон — новий рівень ставки:**

```
Тема: Ваша реферальна ставка підвищилась до 12%!

Ви заробили вже $500+ бонусів. Тепер ваша ставка — 12%
від кожної оплати залучених вами клієнтів.
```

---

## Edge Cases

**1. Реферальний код не знайдено при реєстрації**
Реєстрація продовжується без помилки. `company.referredById` = null. У логах записується warning `referral_code_not_found: workflo-XXXXXX`.

**2. Компанія намагається зареєструватися за власним кодом**
Перевірка: якщо email реєструючогося вже існує в системі і прив'язаний до компанії-реферера — відхиляємо. На практиці неможливо, бо при реєстрації ще немає активної сесії.

**3. Реферальна програма вимкнена**
При `POST /auth/register` якщо `referralSettings.enabled = false` — `referralCode` ігнорується, `referredById` не встановлюється, запис у `referrals` не створюється.

**4. Оплата скасована (chargeback)**
MVP: `processReferralBonus()` викликається тільки при підтвердженні. Скасування оплат в MVP не передбачено. Якщо owner помилково підтвердив оплату — бонус не відкликається (вручну).

**5. Один клієнт платить кілька разів**
Кожне підтвердження оплати генерує окремий `ReferralBonus` запис. Це коректна поведінка — реферер отримує бонус з кожної оплати реферованого клієнта впродовж всього часу співпраці.

**6. Реферер деактивований**
Якщо `Company.isActive = false` — бонус все одно нараховується на `bonusBalance`, але використати його неможливо (Phase 2). Бізнес-рішення: не блокувати нарахування.

**7. Колізія `referralCode` при генерації**

```typescript
async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateReferralCode()
    const existing = await prisma.company.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }
  throw new Error('Failed to generate unique referral code after 3 attempts')
}
```

---

## Подальші фази (ре-букет після фіналізації-2)

- **S5 — Бонус як оплата:** клієнт використовує `bonusBalance` для (часткової) оплати замовлення (через гаманець, модуль 25 + invoice-flow). _(Було «Phase 2» — тепер чітко S5.)_
- **✅ Зроблено — Редагування ставок через UI:** owner змінює пороги/відсотки у `/settings/referral` (`ReferralSettings`, фіналізація-2 §A). _(Більше не майбутнє.)_
- **Реферальна аналітика / гейміфікація:** дашборд залучення, конверсія, `ReferralAchievement`/leaderboard (фіналізація-2 §B).
- **BACKLOG — Depth=2** (непрямі реферали 3–5%) + **кеш-вивід** (конвертація бонусів у гроші) — поза MVP-горизонтом.

---

## Аудит-оновлення (29 травня 2026) — wallet + редаговані %

Уточнення після ревізії покриття (запит власника: гаманець, історія транзакцій, керування %, списання).

### Гаманець — див. модуль 25-wallet

Реферальні нарахування тепер ідуть у **гаманець** (`WalletTransaction` credit, source=`referral_bonus`), а не прямим `increment bonusBalance`. `Company.bonusBalance` лишається кешем балансу. Повна історія транзакцій + admin-екран — у модулі 25.

### Відсотки тепер редаговані (не зашиті)

`REFERRAL_TIERS` у коді стає **дефолтним сидом**; джерело істини — `ReferralSettings.tiers` (БД), редаговане адміном через `PATCH /admin/referral/settings`. `getReferralPercent()` читає з БД (кеш 5хв). Текст «тільки перегляд у MVP» на екрані `/settings/referral` → замінюється на редагований грід тірів (admin).

### Списання бонусів — S5 (не Phase 2-невизначено)

Списання балансу на оплату замовлень реалізуємо **разом з білінгом (S5)** через `walletDebit()` у invoice-flow. До S5 — баланс накопичується і видно історію, але не списується (бо нема invoice-flow). Деталі — модуль 25 секція «Списання на оплату».

---

## Аудит-фіналізація-2 (30 травня 2026) — reconcile + gamification

### A. Обов'язкові reconcile (з MODULE_AUDIT)

- `ReferralBonus` + `referrerId`/`referredId` колонки (код агрегує по `referrerId`!) + idempotency `UNIQUE(sourceType,sourceId)`.
- `Referral` constraint `@@unique([referrerId, referredId])` (узгодити з «1 реферер на компанію»).
- `referralCode` генерується у форматі `workflo-XXXXXX` (НЕ raw uuid default).
- Прибрати legacy `increment bonusBalance` — єдиний шлях через `walletCredit()` (модуль 25).
- `ReferralSettings` (per-agency, editable %). `agencyId` scope. Bonus currency з `amount_usd`. Tier-boundary race → FOR UPDATE.

### B. Referral-дашборд + гейміфікація ✅

- `ReferralAchievement { id, agencyId, code, name, threshold, reward }` + видані `CompanyAchievement`. Лідерборд (top referrers per-agency), progress-бари до next-tier/achievement, бейджі. Event `referral.milestone_reached`.

> **→ BACKLOG (не обрано):** multi-level depth 2+; cash-out бонусів.

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID        | Рішення                                                                                                         | Вплив               | Нюанси власника                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| 09-А      | **Двосторонній бонус give-get** (реферал-новачок теж отримує знижку/стартові бонуси; суми/% у ReferralSettings) | [бек] дрібний       |                                                                                            |
| 09-Б      | **Трекінг воронки лінка** (кліки → реєстрації → перші оплати, видно рефереру)                                   | [бек+екран дрібний] | для аналітики                                                                              |
| 09-Г      | **Згорання бонусів** (expiry N місяців, налаштовується; попередження за 30 днів; cron + wallet-debit `expiry`)  | [бек]               |                                                                                            |
| 09-ВАЛЮТА | **Валюта бонусів у налаштуваннях рефералки** (per-agency вибір валюти нарахування)                              | [бек]               | Звʼязати з мультивалютністю (05-Е); зараз бонус-облік USD-центричний — продумати конверсію |

Відхилено: В (зовнішні партнери-нерезиденти системи з грошовими виплатами) — зафіксовано як «ідея на майбутнє», без закладки зараз.

**Крос-модульні вимоги власника (зафіксовано у REVIEW, рознести):**

- → **07/19:** подія «новий клієнт зареєструвався» → notify власнику/адміну тенанта + метрика реєстрацій на дашборді owner.
- → **28 (client-management):** панель управління клієнтом — ресет пароля, деактивація, редагування (розглянути при модулі 28).
