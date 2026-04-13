# MODULE 05 — BILLING
> App: api.workflo.space / workspace (work.workflo.space) / portal (app.workflo.space)
> Статус: MVP
> Залежить від: [01-auth, 02-companies, 03-orders, 04-services]
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль відповідає за повний фінансовий цикл платформи:
- Розрахунок вартості замовлень (fixed і hourly)
- Recurring послуги з щомісячними нарахуваннями
- Аванси та фінальну оплату
- Конвертацію валют (USD / UAH) через НБУ API
- Ручне підтвердження оплати власником (MVP)
- Loyalty tier оновлення та referral бонуси при підтвердженні оплати
- Адаптер-паттерн для платіжних провайдерів (ManualProvider MVP, LiqPay/Stripe Phase 2)

Борг компанії не зберігається окремим полем — завжди розраховується на льоту:
```
debt = SUM(orders.totalAmount WHERE payment_status != 'paid')
     - SUM(payments.amount WHERE companyId = X)
```

---

## Актори та доступ

| Актор | Права |
|---|---|
| owner | Повний доступ: підтверджує оплати, редагує реквізити, бачить всі фінанси |
| executor | Не має доступу до білінгу клієнтів |
| Company Owner | Бачить борг, реквізити, recurring послуги, платежі своєї компанії |
| Company Member з `can_view_billing=true` | Тільки читання: борг + реквізити |
| Company Member без `can_view_billing` | Не бачить фінансів взагалі |

---

## Бізнес-логіка

### 1. Типи білінгу замовлення

#### Fixed Price
- Owner встановлює `orders.totalAmount` після завершення роботи (або заздалегідь)
- Клієнт бачить фіксовану суму в portal
- Час не впливає на суму (але може логуватися для внутрішніх потреб)

```
Приклад:
  order.billingType = 'fixed'
  order.totalAmount = 1200.00  ← USD
  Клієнт бачить: $1,200.00 / ₴49,800.00
```

#### Hourly
- Ставка клієнта зберігається в `companies.defaultHourlyRateUsd` (можна перевизначити на рівні замовлення в `orders.hourlyRate`)
- Виконавці логують час через time logs
- `totalAmount` = `hourlyRate × SUM(time_logs.hours)` — перераховується автоматично при кожному новому time log
- Owner може зафіксувати кінцеву суму вручну (override)

```
Приклад:
  order.billingType = 'hourly'
  order.hourlyRate  = 40.00   ← $40/год
  SUM(time_logs)   = 12.5 год
  order.totalAmount = 500.00  ← розраховано автоматично
```

**Коли перераховувати `totalAmount` при hourly:**
- При додаванні / редагуванні / видаленні time log
- Не перераховувати якщо owner вручну зафіксував суму (`manualAmountOverride = true`)

### 2. Recurring Services

#### Каталог послуг (таблиця `services`)
Owner створює базові послуги із базовою ціною. Приклади:
- "Обслуговування сервера" — $50/міс базова ціна
- "Технічна підтримка 10 год/міс" — $200/міс базова ціна

#### Призначення клієнту (таблиця `company_services`)
При призначенні послуги конкретному клієнту встановлюється індивідуальна ціна:
```
company_services.customPrice = 65.00  ← перевизначає services.defaultPriceUsd
```

Один клієнт може мати кілька різних recurring послуг одночасно:
```
Компанія "Acme Corp":
  → Обслуговування сервера   $65.00/міс   (customPrice)
  → Технічна підтримка       $180.00/міс  (customPrice)
```

#### pg_cron — генерація service_charges
Щомісяця 1-го числа о 00:01 UTC pg_cron запускає функцію генерації нарахувань:

```sql
-- cron job: '1 0 1 * *' (1-го числа о 00:01 UTC)
SELECT cron.schedule(
  'generate-monthly-charges',
  '1 0 1 * *',
  $$
  INSERT INTO service_charges (
    id, company_id, company_service_id, amount, month, status, created_at
  )
  SELECT
    gen_random_uuid(),
    cs.company_id,
    cs.id,
    cs.custom_price,
    date_trunc('month', now()),
    'pending',
    now()
  FROM company_services cs
  WHERE cs.active = true
  ON CONFLICT (company_service_id, month) DO NOTHING;
  $$
);
```

`service_charges` отримують статус `pending`. Owner вручну підтверджує оплату через workspace.
Нарахування прив'язується до місяця: `UNIQUE(companyServiceId, month)` — дублів не буває.

### 3. Аванс і фінальна оплата

#### Workflow авансу:
1. Клієнт домовляється про передоплату
2. Owner генерує `advance_invoice` PDF (Документи → генерувати)
3. Клієнт платить (переказ/крипта)
4. Owner підтверджує в workspace → створює `Payment { type: 'advance', orderId }`
5. `balance_due` перераховується миттєво

#### Розрахунок balance_due:
```typescript
const advanceTotal = await prisma.payment.aggregate({
  where: { orderId, type: 'advance' },
  _sum: { amount: true },
});

const balanceDue = order.totalAmount - (advanceTotal._sum.amount ?? 0);

// Якщо balanceDue = 0 → order повністю оплачено
if (balanceDue <= 0) {
  await prisma.order.update({
    where: { id: orderId },
    data: { paidAt: new Date(), paymentStatus: 'paid' },
  });
}
```

#### Відображення в portal:
```
Сума замовлення:   $1,000.00 / ₴41,500.00
Сплачено авансом:  $300.00
До оплати:         $700.00 / ₴29,050.00
```

#### Типи платежів (`payments.type`):
- `advance` — передоплата до початку або під час роботи, прив'язана до `orderId`
- `final` — фінальна оплата по завершенні
- `partial` — часткова оплата без статусу аванс (наприклад, погашення боргу по рахунку)

### 4. Валюта та курс обміну

#### Зберігання
Всі суми в БД зберігаються в **USD** (базова валюта). UAH — тільки для відображення.

#### ExchangeRate (singleton)
НБУ API оновлюється автоматично щодня о 09:10 за Києвом:

```
URL: https://bank.gov.ua/NBU_Exchange/exchange_site?valcode=USD&json
Розклад: cron '10 9 * * *' (за Kyiv time = 06:10 UTC в літній час)
```

```typescript
// Приклад відповіді НБУ API:
[{ "r030": 840, "txt": "Долар США", "rate": 41.5, "cc": "USD", "exchangedate": "12.04.2026" }]

// Оновлення в БД:
await prisma.exchangeRate.upsert({
  where: { id: 'singleton' },
  create: { id: 'singleton', usdToUah: 41.5, updatedAt: new Date() },
  update: { usdToUah: 41.5, updatedAt: new Date() },
});
```

**Fallback:** якщо НБУ API недоступне — використовується попереднє значення з БД. Логується попередження в Sentry.

#### Відображення в UI:
```
$500 / ₴20,750
```
```
// helpers/currency.ts
export function formatDualCurrency(usdAmount: number, usdToUah: number): string {
  const uah = usdAmount * usdToUah;
  return `$${usdAmount.toLocaleString('en-US')} / ₴${uah.toLocaleString('uk-UA')}`;
}
```

#### PDF рахунки:
```
500 USD за курсом 41.50 = 20,750.00 UAH
```

`invoiceCurrency` в `PaymentSettings` визначає основну валюту PDF (UAH за замовч., можна змінити на USD або EUR).

### 5. PaymentSettings — реквізити

Singleton-запис в таблиці `payment_settings`. Редагується тільки owner в `/settings/billing`.

**Поля:**
```
bankName        — назва банку (напр. "ПриватБанк")
iban            — IBAN рахунок (напр. "UA213996220000026001052678856")
accountName     — ім'я отримувача
cryptoUsdt      — адреса USDT TRC20
notes           — довільний текст (напр. "Призначення: назва компанії")
invoiceCurrency — валюта PDF: "UAH" | "USD" | "EUR" (default: "UAH")
```

**Як клієнт бачить реквізити:**
Portal → Billing → "Реквізити для оплати" → відображаються `payment_settings` (READ-only для клієнта)

### 6. Manual Payment Flow (MVP)

```
1. Замовлення завершено → owner встановлює totalAmount
2. Portal /billing:
   - Клієнт бачить: борг + реквізити + інструкцію ("Переведіть кошти за реквізитами")
3. Клієнт переказує гроші поза системою (банківський переказ, крипта тощо)
4. Workspace → /billing → pending payments:
   - Owner натискає "Підтвердити оплату"
   - Вводить: amount, type (advance/final/partial), orderId (опціонально), note
   - provider = 'manual', providerPaymentId = null, paymentLink = null
5. Система:
   - Створює Payment record
   - Перераховує balance_due
   - Якщо balance_due = 0 → order.paidAt = now(), paymentStatus = 'paid'
   - Оновлює loyalty tier (якщо потрібно)
   - Нараховує referral бонус (якщо є реферер)
   - Надсилає notification клієнту: "payment_confirmed"
```

### 7. Борг компанії (розрахунок на льоту)

Борг ніколи не зберігається в БД як окреме поле — завжди агрегується при запиті.

```typescript
// services/billing.service.ts
async function getCompanyDebt(companyId: string): Promise<number> {
  const [ordersAgg, paymentsAgg] = await Promise.all([
    prisma.order.aggregate({
      where: {
        companyId,
        totalAmount: { not: null },
        paymentStatus: { not: 'paid' },
        type: 'client_order',
      },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { companyId },
      _sum: { amount: true },
    }),
  ]);

  const totalCharged = Number(ordersAgg._sum.totalAmount ?? 0);
  const totalPaid = Number(paymentsAgg._sum.amount ?? 0);
  return Math.max(0, totalCharged - totalPaid);
}
```

### 8. Loyalty Tier Update

Оновлюється при кожному підтвердженні оплати:

```typescript
// Тири:
// new       → до $500 total spent      → знижка 0%
// regular   → $500 – $2,000            → знижка 5%
// partner   → $2,000 – $5,000          → знижка 10%
// vip       → $5,000+                  → знижка 15%

async function updateLoyaltyTier(companyId: string, paidAmount: number): Promise<void> {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { totalSpent: { increment: paidAmount } },
  });

  const newTier = calculateTier(Number(company.totalSpent));
  const oldTier = company.loyaltyTier;

  if (newTier !== oldTier) {
    await prisma.company.update({
      where: { id: companyId },
      data: { loyaltyTier: newTier },
    });
    // Відправити нотифікацію loyalty_tier_changed
    await notify(company.ownerId, 'loyalty_tier_changed', { oldTier, newTier });
  }
}

function calculateTier(totalSpent: number): LoyaltyTier {
  if (totalSpent >= 5000) return 'vip';
  if (totalSpent >= 2000) return 'partner';
  if (totalSpent >= 500)  return 'regular';
  return 'new';
}
```

**Важливо:** Owner може перевизначити tier вручну в workspace (з причиною). При цьому `manuallyOverridden = true` і автоматичне оновлення при наступних платежах ігнорується доки owner не скасує override.

### 9. Referral Bonus при оплаті

При підтвердженні оплати (depth=1 — тільки прямий реферер, без мультирівнів в MVP):

```typescript
async function processReferralBonus(companyId: string, paidAmount: number): Promise<void> {
  // Знайти реферера (хто запросив цю компанію)
  const referral = await prisma.referral.findFirst({
    where: { referredCompanyId: companyId, status: 'qualified' },
    include: { referrerCompany: true },
  });

  if (!referral) return;

  // Прогресивна ставка по зароблених бонусах реферера
  const totalEarned = Number(referral.referrerCompany.bonusBalance);
  const rate = totalEarned >= 500 ? 0.15 : totalEarned >= 200 ? 0.12 : 0.10;
  const bonusAmount = paidAmount * rate;

  await prisma.$transaction([
    prisma.company.update({
      where: { id: referral.referrerCompanyId },
      data: { bonusBalance: { increment: bonusAmount } },
    }),
    prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'rewarded',
        rewardPercent: rate * 100,
        rewardAmountUsd: bonusAmount,
        rewardedAt: new Date(),
      },
    }),
  ]);

  // Відправити нотифікацію реферерові
  await notify(referral.referrerCompany.ownerId, 'referral_bonus', {
    bonusAmount,
    fromCompanyName: '...',
  });
}
```

**Прогресивна ставка:**
```
Зароблено $0 – $200    → 10%
Зароблено $200 – $500  → 12%
Зароблено $500+        → 15%
```

Бонусний баланс = знижка на власні замовлення (не кеш). При створенні замовлення клієнт може застосувати бонус (`bonusUsedUsd` на order).

### 10. PaymentProvider — адаптер паттерн

```typescript
// packages/types/src/billing.ts
export interface PaymentProvider {
  name: string;
  createPaymentLink(params: CreatePaymentParams): Promise<PaymentLinkResult>;
  handleWebhook(payload: unknown): Promise<WebhookResult>;
  verifySignature(payload: string, signature: string): boolean;
}

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
}

export interface PaymentLinkResult {
  paymentLink: string;
  providerPaymentId: string;
}
```

```typescript
// apps/api/src/providers/manual.provider.ts — MVP
export class ManualProvider implements PaymentProvider {
  name = 'manual';

  async createPaymentLink(): Promise<PaymentLinkResult> {
    // Manual flow — немає посилання для оплати
    return { paymentLink: '', providerPaymentId: '' };
  }

  async handleWebhook(): Promise<WebhookResult> {
    throw new Error('ManualProvider does not support webhooks');
  }

  verifySignature(): boolean {
    return true; // Manual — підтверджується власником вручну
  }
}

// Phase 2: LiqPayProvider, StripeProvider — окремі файли, той самий interface
```

---

## DB

### Таблиця `payments`

```prisma
model Payment {
  id                String        @id @default(uuid())
  companyId         String
  company           Company       @relation(fields: [companyId], references: [id])
  orderId           String?       // nullable — деякі платежі не прив'язані до конкретного замовлення
  order             Order?        @relation(fields: [orderId], references: [id])
  amount            Decimal       @db.Decimal(10, 2)
  currency          String        @default("USD")
  type              PaymentType   @default(final)  // advance | final | partial
  provider          String        @default("manual")  // manual | liqpay | stripe | monobank
  providerPaymentId String?       // ID транзакції у провайдері
  paymentLink       String?       // URL для онлайн-оплати (Phase 2)
  paymentMethod     String?       // bank_transfer | card | crypto | cash | other
  paymentReference  String?       // номер переказу або txid
  note              String?
  confirmedBy       String        // profileId owner'а
  confirmedAt       DateTime      @default(now())

  @@index([companyId])
  @@index([orderId])
  @@index([confirmedAt])
  @@map("payments")
}

enum PaymentType {
  advance
  final
  partial
}
```

### Таблиця `payment_settings` (singleton)

```prisma
model PaymentSettings {
  id              String   @id @default(cuid())
  bankName        String?
  iban            String?
  accountName     String?
  cryptoUsdt      String?  // USDT TRC20 адреса
  notes           String?
  invoiceCurrency String   @default("UAH")  // UAH | USD | EUR
  updatedAt       DateTime @updatedAt

  @@map("payment_settings")
}
```

### Таблиця `exchange_rates` (singleton)

```prisma
model ExchangeRate {
  id        String   @id @default("singleton")
  usdToUah  Decimal  @db.Decimal(8, 4)
  eurToUah  Decimal? @db.Decimal(8, 4)
  updatedAt DateTime @updatedAt
  updatedBy String?  // profileId або 'cron'

  @@map("exchange_rates")
}
```

### Таблиця `service_charges`

```prisma
model ServiceCharge {
  id               String        @id @default(uuid())
  companyId        String
  company          Company       @relation(fields: [companyId], references: [id])
  companyServiceId String
  companyService   CompanyService @relation(fields: [companyServiceId], references: [id])
  amount           Decimal       @db.Decimal(10, 2)
  uahRate          Decimal?      @db.Decimal(8, 4)  // курс на момент нарахування
  month            DateTime      @db.Date           // перший день місяця
  status           ChargeStatus  @default(pending)
  dueDate          DateTime?
  paidAt           DateTime?
  notes            String?
  createdAt        DateTime      @default(now())

  @@unique([companyServiceId, month])  // один charge per послугу per місяць
  @@index([companyId, month])
  @@map("service_charges")
}

enum ChargeStatus {
  pending
  paid
  overdue
}
```

---

## API Endpoints

### Portal (клієнт)

```
GET  /billing/summary
```
Повертає: борг, recurring services, payments total, loyalty tier, bonus balance.

```json
{
  "data": {
    "debt": 700.00,
    "debtUah": 29050.00,
    "services": [
      { "name": "Обслуговування сервера", "priceUsd": 65.00, "priceUah": 2697.50 }
    ],
    "totalPaid": 1300.00,
    "loyaltyTier": "regular",
    "discountPercent": 5,
    "bonusBalance": 45.00,
    "paymentSettings": {
      "bankName": "ПриватБанк",
      "iban": "UA213996220000026001052678856",
      "accountName": "ФОП Іваненко І.І.",
      "cryptoUsdt": "TXyz...abc",
      "notes": "Призначення: назва вашої компанії"
    }
  }
}
```

```
GET  /billing/services          — recurring послуги клієнта
GET  /billing/charges           — нарахування, ?month=2026-04
GET  /billing/payments          — історія підтверджених оплат
GET  /billing/payment-settings  — реквізити (публічно, без авторизації якщо є публічний endpoint)
```

### Workspace (owner)

```
GET  /workspace/billing/overview
```
Повертає: загальний борг всіх клієнтів, суму за поточний місяць, топ боржників.

```
POST /workspace/billing/payments
```
Body:
```json
{
  "companyId": "uuid",
  "orderId": "uuid",          // optional
  "amount": 700.00,
  "type": "final",            // advance | final | partial
  "paymentMethod": "bank_transfer",
  "paymentReference": "UA20240412001",
  "note": "Оплата по рахунку INV-2026-0042"
}
```

Відповідь 201:
```json
{
  "data": {
    "id": "uuid",
    "companyId": "uuid",
    "amount": 700.00,
    "type": "final",
    "confirmedAt": "2026-04-12T10:30:00Z",
    "newDebt": 0,
    "orderPaidAt": "2026-04-12T10:30:00Z"  // якщо balance_due = 0
  }
}
```

```
GET  /workspace/billing/charges         — всі нарахування, ?month=2026-04&companyId=
GET  /workspace/billing/payouts         — розрахунок виплат команді за місяць
GET  /workspace/settings/payment        — поточні PaymentSettings
PATCH /workspace/settings/payment       — оновити реквізити
GET  /workspace/settings/exchange-rate  — поточний курс + дата оновлення
PATCH /workspace/settings/exchange-rate — вручну оновити курс (owner)
POST /workspace/settings/exchange-rate/refresh — примусово оновити з НБУ API
```

### Workspace — Services Management (owner)

```
GET    /workspace/services                             — список всіх recurring послуг (каталог)
POST   /workspace/services                             — створити нову послугу
Body: { name: string, defaultPriceUsd: number, description?: string, isRecurring: boolean }

PATCH  /workspace/services/:id                        — оновити послугу (назву/ціну)
DELETE /workspace/services/:id                        — видалити (тільки якщо немає активних company_services)

POST   /workspace/services/:id/assign                 — призначити послугу клієнту
Body: { companyId: string, customPrice: number }
→ Створює company_services запис з customPrice, active=true, nextChargeDate=1-го наступного місяця

PATCH  /workspace/services/:id/companies/:companyId   — змінити ціну або зупинити
Body: { customPrice?: number, active?: boolean }

DELETE /workspace/services/:id/companies/:companyId   — відписати компанію від послуги (active=false)
```

---

## UI Flows

### Portal — Billing Page (`/billing`)

```
┌─────────────────────────────────────────────┐
│  ФІНАНСИ                                     │
│                                              │
│  Поточний борг:  $700.00 / ₴29,050.00        │
│  [badge: "До оплати"]                        │
│                                              │
│  Ваш тир:  Regular   Знижка: 5%             │
│  До Partner: ще $800.00                      │
│                                              │
│  ─── Реквізити для оплати ───────────────    │
│  Банк: ПриватБанк                            │
│  IBAN: UA21 3996 2200 0002 6001 0526 7885 6  │
│  USDT TRC20: TXyz...abc  [copy]              │
│  Призначення: Acme Corp                      │
│                                              │
│  ─── Recurring послуги ──────────────────    │
│  Обслуговування сервера    $65/міс           │
│  Технічна підтримка       $180/міс           │
│                                              │
│  ─── Нарахування ────────────────────────    │
│  Квітень 2026 — $245.00   [pending]          │
│  Березень 2026 — $245.00  [paid]             │
│                                              │
│  ─── Історія платежів ───────────────────    │
│  12.04.2026  $700.00  final  [підтверджено]  │
│  01.03.2026  $300.00  advance                │
└─────────────────────────────────────────────┘
```

### Workspace — Підтвердження оплати

```
Workspace → /billing → [Підтвердити оплату]

Modal:
  Компанія:         [dropdown — пошук]
  Замовлення:       [dropdown — відкриті замовлення компанії] (optional)
  Сума (USD):       [input]
  Тип:              [advance | final | partial]
  Спосіб:           [bank_transfer | crypto | cash | other]
  Референс:         [input: номер переказу або txid]
  Нотатка:          [textarea]
  [Підтвердити] [Скасувати]
```

### Workspace — Settings / Billing

```
/settings/billing:
  Банк IBAN:          [input]
  Назва банку:        [input]
  Ім'я отримувача:    [input]
  USDT TRC20:         [input]
  Примітки:           [textarea]
  Валюта PDF:         [select: UAH | USD | EUR]

  Курс USD/UAH:       41.50  (оновлено: 12.04.2026 09:10)
  [Оновити з НБУ]  [Встановити вручну]
```

---

## Notifications

| Подія | Отримувач | Канал |
|---|---|---|
| Оплата підтверджена | Company Owner | email + telegram |
| Нарахована recurring послуга | Company Owner | email |
| Підвищення loyalty tier | Company Owner | email + telegram |
| Referral бонус нарахований | Referrer Company Owner | email + telegram |
| Борг прострочений (Phase 2) | Company Owner | email |

---

## Edge Cases

**1. Аванс більше totalAmount**
- Якщо `SUM(advance) > totalAmount` — `balance_due` = 0 (клієнт переплатив)
- Переплата зараховується як бонус або повертається вручну (вирішується owner окремо)
- UI попереджує owner при підтвердженні аванс > totalAmount

**2. totalAmount змінюється після часткової оплати**
- `balance_due` перераховується автоматично при кожному запиті
- Якщо після зміни `totalAmount` balance_due < 0 → показати warning owner'у

**3. pg_cron не запустився (збій)**
- `service_charges` з `UNIQUE(companyServiceId, month)` захищають від дублів
- Ручний запуск через workspace: `POST /workspace/billing/charges/generate { month: "2026-04-01" }`
- Логується в Sentry

**4. НБУ API недоступне**
- Використовується попередній курс з `exchange_rates`
- Якщо `updatedAt` > 3 дні — показувати warning в workspace settings
- Sentry alert при HTTP помилці від НБУ

**5. Company Owner підтверджує оцінку з loyalty знижкою**
- При `billingType=fixed` і наявному тирі — UI показує: `$1000 → -5% → $950`
- `discountAppliedPercent` зберігається на order
- Знижка застосовується тільки якщо manually не override

**6. Компанія призупинена (`is_active = false`)**
- pg_cron пропускає `company_services` де `company.isActive = false`
- Нові `service_charges` не генеруються

---

## Phase 2

- **LiqPay / Stripe / Monobank:** нові класи `LiqPayProvider`, `StripeProvider`, `MonobankProvider` — реалізують `PaymentProvider` інтерфейс. Вебхуки `/webhook/liqpay`, `/webhook/stripe`. Таблиця `payments` вже готова (поля `provider`, `providerPaymentId`, `paymentLink`).
- **Автоматичний recurring billing:** замість ручного підтвердження — автосписання через LiqPay recurring
- **Email-нагадування про борг:** cron job щотижня — компаніям з `debt > 0`
- **Інвойс scheduling:** клієнт обирає дату виставлення рахунку
- **Multi-currency:** додати EUR як третю валюту
- **Partial payment allocation:** розподіл часткової оплати між кількома замовленнями
