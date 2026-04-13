# MODULE 09 — REFERRAL SYSTEM
> App: Portal (`portal.workflo.space`) + Workspace (`work.workflo.space`)
> Статус: MVP
> Залежить від: [01-auth, 02-company, 07-billing-payments]
> Оновлено: 12 квітня 2026

---

## Огляд

Реферальна програма дозволяє компаніям-клієнтам залучати нових клієнтів в обмін на бонусний баланс. Кожна зареєстрована компанія отримує унікальний реферальний код формату `workflo-XXXXXX`. При реєстрації нового клієнта за реферальним посиланням система фіксує зв'язок. Після кожного підтвердження оплати реферованого клієнта система автоматично нараховує бонус на баланс реферера.

**MVP обмеження:**
- Глибина дерева = 1 (тільки прямі реферали, depth=1)
- Бонусний баланс відображається, але не може бути використаний для оплати (тільки в Phase 2)
- Відсоток прогресивний і залежить від загальної суми зароблених бонусів реферера

---

## Актори та доступ

| Актор | Доступ |
|---|---|
| Company Owner (Portal) | Бачить своє реферальне посилання, QR-код, список залучених компаній, зароблені бонуси |
| Company Member | Не має доступу до реферальної сторінки (це білінгова інформація) |
| Owner (Workspace) | Бачить реферальну статистику по всіх компаніях у `/settings/referral`, може вмикати/вимикати програму |
| Executor | Немає доступу |

---

## Бізнес-логіка

### Генерація коду

Реферальний код генерується автоматично при реєстрації компанії. Формат: `workflo-XXXXXX`, де `XXXXXX` — 6 символів з алфавіту `A-Z0-9` (Base36 без малих літер).

```typescript
// apps/api/src/modules/company/company.service.ts
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const code = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `workflo-${code}`;
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

Ставка визначається за сумою вже зароблених бонусів реферером (`referrals.totalEarned` — сума по всіх реферальних зв'язках реферера):

```typescript
// packages/types/src/constants.ts
export const REFERRAL_TIERS = [
  { minEarned: 0,    maxEarned: 499.99,  percent: 10 },
  { minEarned: 500,  maxEarned: 1999.99, percent: 12 },
  { minEarned: 2000, maxEarned: Infinity, percent: 15 },
] as const;

function getReferralPercent(totalReferralEarned: Decimal): number {
  const earned = totalReferralEarned.toNumber();
  if (earned < 500)  return 10;
  if (earned < 2000) return 12;
  return 15;
}
```

Приклад: реферер вже заробив $480 бонусів → нове нарахування відбудеться за ставкою 10%. Наступне нарахування, яке підніме суму вище $500, вже відбудеться за ставкою 12% (ставка рахується на момент кожного нарахування).

### Нарахування бонусу при оплаті

Функція `processReferralBonus()` викликається автоматично після кожного підтвердження оплати (`POST /workspace/billing/payments`):

```typescript
// apps/api/src/modules/billing/referral.service.ts
async function processReferralBonus(payment: Payment): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: payment.companyId },
    select: { referredById: true },
  });

  if (!company?.referredById) return; // не реферал — нічого не робимо

  const referral = await prisma.referral.findFirst({
    where: {
      referrerId: company.referredById,
      referredId: payment.companyId,
    },
  });

  if (!referral) return;

  // Рахуємо загальний зароблений бонус реферера
  const totalEarned = await prisma.referralBonus.aggregate({
    _sum: { amount: true },
    where: { referrerId: company.referredById },
  });

  const currentTotal = totalEarned._sum.amount ?? new Decimal(0);
  const percent = getReferralPercent(currentTotal);
  const bonusAmount = payment.amount.mul(percent).div(100);

  await prisma.$transaction([
    // Запис бонусу
    prisma.referralBonus.create({
      data: {
        referrerId: company.referredById,
        referredId: payment.companyId,
        referralId: referral.id,
        amount: bonusAmount,
        percent,
        sourceType: 'payment',
        sourceId: payment.id,
      },
    }),
    // Збільшуємо bonusBalance реферера
    prisma.company.update({
      where: { id: company.referredById },
      data: { bonusBalance: { increment: bonusAmount } },
    }),
    // Оновлюємо totalEarned в referrals
    prisma.referral.update({
      where: { id: referral.id },
      data: { totalEarned: { increment: bonusAmount } },
    }),
  ]);

  // Нотифікація реферера
  await notify(referrerOwnerUserId, 'referral_bonus_earned', {
    amount: bonusAmount,
    percent,
    referredCompanyName: payment.company.name,
  });
}
```

**Транзакційність:** всі 3 операції (запис бонусу, оновлення balansу, оновлення referral.totalEarned) виконуються в одній DB транзакції. При помилці жодна зміна не зберігається.

---

## DB

```prisma
model Company {
  // ... інші поля
  referralCode  String   @unique  // "workflo-K7X2QM"
  referredById  String?           // id компанії-реферера (nullable)
  bonusBalance  Decimal  @default(0) @db.Decimal(12, 2)

  referralsSent     Referral[] @relation("ReferrerCompany")
  referralsReceived Referral[] @relation("ReferredCompany")
  referralBonuses   ReferralBonus[] @relation("ReferrerBonuses")

  @@index([referralCode])
  @@map("companies")
}

// Зв'язок реферер → реферований (MVP: depth=1)
model Referral {
  id          String   @id @default(uuid())
  referrerId  String                          // компанія-реферер
  referrer    Company  @relation("ReferrerCompany", fields: [referrerId], references: [id])
  referredId  String   @unique                // компанія-реферований (unique: одна компанія має одного реферера)
  referred    Company  @relation("ReferredCompany", fields: [referredId], references: [id])
  totalEarned Decimal  @default(0) @db.Decimal(12, 2)
  createdAt   DateTime @default(now())

  bonuses ReferralBonus[]

  @@index([referrerId])
  @@map("referrals")
}

// Окремий запис по кожному нарахуванню
model ReferralBonus {
  id         String   @id @default(uuid())
  referrerId String
  referrer   Company  @relation("ReferrerBonuses", fields: [referrerId], references: [id])
  referredId String
  referralId String
  referral   Referral @relation(fields: [referralId], references: [id])
  amount     Decimal  @db.Decimal(12, 2)      // сума нарахування
  percent    Int                               // 10 | 12 | 15
  sourceType String   @default("payment")     // "payment" в MVP
  sourceId   String                           // payments.id
  createdAt  DateTime @default(now())

  @@index([referrerId])
  @@index([sourceId])
  @@map("referral_bonuses")
}
```

**Implicit tree в БД:** `Company.referredById` зберігає пряме посилання на компанію-реферера. Для Phase 2 (depth=2) достатньо зробити запит `WHERE referredById IN (SELECT id FROM companies WHERE referredById = $rootReferrerId)` — структура БД вже підтримує це без змін.

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
      { "minEarned": 0,    "maxEarned": 499.99,  "percent": 10 },
      { "minEarned": 500,  "maxEarned": 1999.99, "percent": 12 },
      { "minEarned": 2000, "maxEarned": null,     "percent": 15 }
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
│  Прогресивні ставки (тільки перегляд у MVP):         │
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

| Подія | Канал | Отримувач |
|---|---|---|
| Реферований клієнт зареєструвався | Email + Telegram | Реферер (Company Owner) |
| Нараховано бонус після оплати | Email + Telegram | Реферер (Company Owner) |
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
    const code = generateReferralCode();
    const existing = await prisma.company.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique referral code after 3 attempts');
}
```

---

## Phase 2

- **Depth=2:** нарахування 3–5% від оплат непрямих рефералів (реферали рефералів). Реалізується через рекурсивний запит по `company.referredById` ланцюжку (максимальна глибина = 2).
- **Бонус balance як оплата:** клієнт може використати `bonusBalance` для повної або часткової оплати замовлення. Реалізується як окремий тип платежу `payment_method = 'bonus_balance'`.
- **Редагування ставок через UI:** owner може змінювати пороги і відсотки у `/settings/referral`.
- **Реферальна аналітика:** графік залучення нових клієнтів, конверсія реферальних посилань.
- **Кеш-вивід:** можливість конвертувати бонуси в реальну оплату (обговорюється).
