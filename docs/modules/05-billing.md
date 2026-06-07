# MODULE 05 — BILLING

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: api.workflo.space / workspace (work.workflo.space) / portal (portal.workflo.space)
> Статус: MVP
> Залежить від: [01-auth, 02-companies, 03-orders, 04-services]
> Оновлено: 2 червня 2026 (doc-sync)

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

| Актор                                    | Права                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| owner                                    | Повний доступ: підтверджує оплати, редагує реквізити, бачить всі фінанси |
| executor                                 | Не має доступу до білінгу клієнтів                                       |
| Company Owner                            | Бачить борг, реквізити, recurring послуги, платежі своєї компанії        |
| Company Member з `can_view_billing=true` | Тільки читання: борг + реквізити                                         |
| Company Member без `can_view_billing`    | Не бачить фінансів взагалі                                               |

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
})

const balanceDue = order.totalAmount - (advanceTotal._sum.amount ?? 0)

// Якщо balanceDue = 0 → order повністю оплачено
if (balanceDue <= 0) {
  await prisma.order.update({
    where: { id: orderId },
    data: { paidAt: new Date(), paymentStatus: 'paid' },
  })
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

#### ExchangeRate (per-agency, S-D2)

НБУ API оновлюється автоматично щодня о 09:10 за Києвом:

```
URL: https://bank.gov.ua/NBU_Exchange/exchange_site?valcode=USD&json
Розклад: cron '10 9 * * *' (за Kyiv time = 06:10 UTC в літній час)
```

```typescript
// Курс — per-agency (S-D2), НЕ глобальний singleton. Upsert по agencyId:
await prisma.exchangeRate.upsert({
  where: { agencyId },
  create: { agencyId, usdToUah: 41.5 },
  update: { usdToUah: 41.5, updatedBy: 'cron' },
})
```

> ⚠️ **Застаріле `id: 'singleton'` видалено** — `ExchangeRate.agencyId @unique` (міграція `20260602_sd234`). НБУ-курс об'єктивно один, але per-agency дає override + ізоляцію.

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

Один запис **на агенцію** (`PaymentSettings.agencyId @unique`, S-D2) у таблиці `payment_settings`. Редагується тільки owner в `/settings/billing`.

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
  ])

  const totalCharged = Number(ordersAgg._sum.totalAmount ?? 0)
  const totalPaid = Number(paymentsAgg._sum.amount ?? 0)
  return Math.max(0, totalCharged - totalPaid)
}
```

### 8. Loyalty Tier Update

> ⚠️ **SUPERSEDED — канон лояльності НЕ тут.** Пороги/відсотки нижче (500/2k/5k @ 0/5/10/15)
> застарілі. Єдине джерело істини — `@workflo/types` `LOYALTY_DISCOUNT_PCT`
> (NEW/REGULAR/PARTNER/VIP @ **0/3/7/12%** від **$0/1k/5k/15k**) + модуль
> [`10-loyalty.md`](10-loyalty.md). Не реалізовувати з прикладу нижче.

Канонічні правила (звіряй з кодом `packages/types/src/constants.ts`):

- Тири і знижки: див. `LOYALTY_DISCOUNT_PCT` / `LOYALTY_TIER_THRESHOLDS` у `@workflo/types`.
- `Company.totalSpent` має **єдиного писаря** — cron перерахунку лояльності (модуль 10),
  а НЕ `increment` на кожному платежі (анти-подвійний-запис, аудит 10-loyalty §КРИТИЧНО).
- Подія: `loyalty.tier_upgraded` (не `loyalty_tier_changed`).
- Override: `Company.tierOverride` + `LoyaltyTierHistory` (S5).

**Важливо:** Owner може перевизначити tier вручну (`tierOverride`) — тоді автоперерахунок
cron'ом ігнорується, доки override не знято.

### 9. Referral Bonus при оплаті

> ⚠️ **SUPERSEDED — канон рефералів у [`09-referral.md`](09-referral.md).** Нарахування
> йде ЄДИНИМ шляхом через wallet (`walletCredit`, ledger `WalletTransaction`) з
> ідемпотентністю `UNIQUE(sourceType,sourceId)` (закладено в схемі), а НЕ прямим
> `bonusBalance: { increment }` нижче. Ставки/пороги — теж у 09-referral (звіряй з кодом).
> Приклад нижче лишено історично, не реалізовувати.

При підтвердженні оплати (depth=1 — тільки прямий реферер, без мультирівнів в MVP):

```typescript
async function processReferralBonus(companyId: string, paidAmount: number): Promise<void> {
  // Знайти реферера (хто запросив цю компанію)
  const referral = await prisma.referral.findFirst({
    where: { referredCompanyId: companyId, status: 'qualified' },
    include: { referrerCompany: true },
  })

  if (!referral) return

  // Прогресивна ставка по зароблених бонусах реферера
  const totalEarned = Number(referral.referrerCompany.bonusBalance)
  const rate = totalEarned >= 500 ? 0.15 : totalEarned >= 200 ? 0.12 : 0.1
  const bonusAmount = paidAmount * rate

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
  ])

  // Відправити нотифікацію реферерові
  await notify(referral.referrerCompany.ownerId, 'referral_bonus', {
    bonusAmount,
    fromCompanyName: '...',
  })
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
  name: string
  createPaymentLink(params: CreatePaymentParams): Promise<PaymentLinkResult>
  handleWebhook(payload: unknown): Promise<WebhookResult>
  verifySignature(payload: string, signature: string): boolean
}

export interface CreatePaymentParams {
  orderId: string
  amount: number
  currency: string
  description: string
  returnUrl: string
}

export interface PaymentLinkResult {
  paymentLink: string
  providerPaymentId: string
}
```

```typescript
// apps/api/src/providers/manual.provider.ts — MVP
export class ManualProvider implements PaymentProvider {
  name = 'manual'

  async createPaymentLink(): Promise<PaymentLinkResult> {
    // Manual flow — немає посилання для оплати
    return { paymentLink: '', providerPaymentId: '' }
  }

  async handleWebhook(): Promise<WebhookResult> {
    throw new Error('ManualProvider does not support webhooks')
  }

  verifySignature(): boolean {
    return true // Manual — підтверджується власником вручну
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

### Таблиці `payment_settings` + `exchange_rates` (per-agency, S-D2)

> **Канон — `packages/db/prisma/schema.prisma`** (міграція `20260602_sd234`). Обидві — **per-agency**, не глобальні singletons:
>
> - `PaymentSettings` — `agencyId String @unique` + FK (реквізити агенції: `bankName/iban/accountName/cryptoUsdt/invoiceCurrency`).
> - `ExchangeRate` — `agencyId String @unique` + FK; `id @default(uuid())` (НЕ `"singleton"`); `usdToUah`/`eurToUah Decimal(10,4)`; `updatedBy`.
>
> ⚠️ Глобальний `id='singleton'` + `Decimal(8,4)` — **видалено** (S-D2: крос-тенант реквізити/курс = катастрофа). `DocumentCounter` теж per-agency (`@@id([agencyId,type,year])`, модуль 06).

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
    "debt": 700.0,
    "debtUah": 29050.0,
    "services": [{ "name": "Обслуговування сервера", "priceUsd": 65.0, "priceUah": 2697.5 }],
    "totalPaid": 1300.0,
    "loyaltyTier": "regular",
    "discountPercent": 5,
    "bonusBalance": 45.0,
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
  "orderId": "uuid", // optional
  "amount": 700.0,
  "type": "final", // advance | final | partial
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
    "amount": 700.0,
    "type": "final",
    "confirmedAt": "2026-04-12T10:30:00Z",
    "newDebt": 0,
    "orderPaidAt": "2026-04-12T10:30:00Z" // якщо balance_due = 0
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

| Подія                        | Отримувач              | Канал            |
| ---------------------------- | ---------------------- | ---------------- |
| Оплата підтверджена          | Company Owner          | email + telegram |
| Нарахована recurring послуга | Company Owner          | email            |
| Підвищення loyalty tier      | Company Owner          | email + telegram |
| Referral бонус нарахований   | Referrer Company Owner | email + telegram |
| Борг прострочений (Phase 2)  | Company Owner          | email            |

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

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### Payment race guard

**Проблема:** клієнт натискає "Confirm payment" двічі → дві Payment rows для одного charge → balance подвоюється.

**Рішення:**

1. **UNIQUE(sourceType, sourceId)** на `payments` — два payments не можуть посилатися на той самий external source (bank transaction id, Stripe charge id, manual confirmation token).
2. **SELECT FOR UPDATE** на `service_charges` всередині Serializable transaction.
3. Idempotency key required для всіх POST payment endpoints (`Idempotency-Key` header, valid 24h per key+endpoint).

```typescript
await prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
    const charge = await tx.$queryRaw`
    SELECT * FROM service_charges WHERE id = ${chargeId} FOR UPDATE
  `
    if (charge.status === 'paid') {
      throw new ConflictError('charge_already_paid')
    }
    // ... insert payment + update charge.status='paid'
  },
  { isolationLevel: 'Serializable' }
)
```

Duplicate payment INSERT → unique constraint error → 409 to caller з reference до існуючого payment.

### Auto-invoicing flow

Owner налаштовує **recurring billing** для company:

- Frequency: monthly / quarterly / annual.
- Items: fixed nomenclature codes + quantities.
- Day of month: 1st / 15th / last (configurable).

Cron `C02:recurring_billing` (щодня 00:30):

- Знаходить всі `company_billing_subscriptions` де `next_invoice_at <= now()`.
- Для кожної: create `Document(type='invoice')` + `ServiceCharge` + send via `notify(event='billing.invoice_sent')`.
- Update `next_invoice_at` = next period.

Idempotency: cron записує lock у `cron_runs.metadata.processed_ids` — повторний run skip-ить уже processed.

### Debtors dashboard

Див. **19-reports.md → секція "3. Debtors Report"**. UI у `/workspace/reports/debtors`.

Auto-notification: cron `C07:invoice_overdue_marker` ставить `service_charges.status = 'overdue'` де `due_date < now()` AND `status = 'pending'`. Тригер `notify(event='billing.invoice_overdue')` до company owner.

### Acts of reconciliation

Новий document type `reconciliation_act` (добавлено в S1-03 migration).

Owner генерує сверку:

1. `POST /companies/:id/reconciliation-acts { from, to }`
2. Backend агрегує всі invoices + payments + adjustments за період.
3. Generates PDF з branding (модуль 20).
4. Save як `Document(type='reconciliation_act', status='generated')`.
5. Owner reviews → "Send to client" → `notify(event='documents.reconciliation_act_ready')`.

### Currency handling

- `payments.amount_native` — у валюті operation.
- `payments.amount_usd` — конвертовано через `exchange_rates` на дату payment (захоплюємо моментальний rate, не latest, щоб history стабільна).
- `service_charges` similarly зберігає `base_amount_native + base_amount_usd + currency_native`.
- Reports завжди в USD (single source of truth для KPI).

---

## Payment Type Classification (аудит-уточнення, 29 травня 2026)

Узгодження двох видів оплат, щоб не плодити конкуруючі моделі (архітектурний ризик R3).

### Два канонічні види

| Вид                       | Що це                                      | Модель даних                                                  | Тригер         |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------- | -------------- |
| **One-time**              | разова оплата за замовлення (fixed/hourly) | `Order` → `Payment{type: advance\|final\|partial}`            | manual confirm |
| **Recurring (абонплата)** | щомісячна/квартальна/річна послуга         | `Service` → `CompanyService` → `ServiceCharge{month, status}` | cron C02       |

### КАНОНІЧНА модель recurring — `Service / CompanyService / ServiceCharge`

**Рішення (R3):** `Service`/`CompanyService`/`ServiceCharge` — **єдине джерело істини** для recurring-доходу. Чернетку `company_billing_subscription` зі старої S1-alignment-секції **відкидаємо** (вона дублювала те саме). Debtors-звіт + P&L + portal billing читають `service_charges` — одне джерело, без розбіжностей.

### Підтримка не-місячної частоти

Якщо потрібна квартальна/річна абонплата, додаємо у `CompanyService` (НЕ нову таблицю):

```prisma
model CompanyService {
  // ...наявні поля
  frequency    BillingFrequency @default(monthly)  // monthly|quarterly|annual
  nextChargeAt DateTime         @db.Timestamptz(3) // коли генерувати наступний ServiceCharge
}
```

Cron C02 обробляє `WHERE nextChargeAt <= now()` замість фіксованого «1-го числа», і зсуває `nextChargeAt` на наступний період. Дешево додати зараз (компанії ще не на планах) — болісно ретрофітити пізніше. Див. BACKLOG «do-now D4».

### Зв'язок Company ↔ BillingPlan (передумова для підписок платформи)

`BillingPlan` зараз — каталог без зв'язку з компанією. Для підписки на саму платформу (не на послуги агенції) потрібна `CompanySubscription{companyId, planId, status, currentPeriodStart/End, canceledAt}`. Додаємо коли реалізуємо платформні підписки (S5+). Зараз — лише зафіксувати в схемі-плані (BACKLOG «S1.5 schema prep»).

### Автосписання (Фаза 2)

`PaymentProvider`-адаптер (Manual MVP → Stripe/LiqPay) робить авто-charge recurring підписок drop-in замінною, без переписування. Manual confirm достатньо для MVP.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

> Авторитетна секція. Деталі foundational-фіксів — у `docs/archive/MODULE_AUDIT.md` (T3).

### A. Обов'язкові reconcile (T3)

VAT/ПДВ-колонки (`taxRatePct/taxAmount/netAmount` + tax-inclusive) + `agency.defaultTaxRatePct`; `Payment.amountUsd+amountNative+rateUsed`; idempotency `UNIQUE(sourceType,sourceId)` на payments/referral_bonuses/wallet_transactions; `ServiceCharge.{baseAmount,discountPct,discountAmount,totalAmount}` + first-class line-items; `CompanyService.frequency+nextChargeAt`; `ServiceCharge.status='written_off'`; **один канонічний debt** (= wallet moneyBalance, не три); refund/credit-note модель; `agencyId` + per-agency `PaymentSettings`/`ExchangeRate`; loyalty-тіри — один constants (05↔10).

### B. Online payments — провайдери ✅ (Monobank, Stripe, WayForPay/Fondy)

- Розширити `packages/payments` `PaymentProvider` до повного: `createPaymentLink(params)`, `handleWebhook(payload, sig)`, `verifySignature()`, `refund(paymentId, amount)`.
- Адаптери: `ManualProvider` (є), `MonobankProvider`, `StripeProvider`, `WayForPayProvider`. Вибір per-agency (`PaymentSettings.providers`).
- `PaymentIntent { id, agencyId, companyId, chargeId/invoiceId, provider, providerIntentId, amount, currency, status(created|pending|paid|failed|expired), paymentLink, createdAt }`.
- Webhook: `POST /webhooks/payments/:provider` — verifySignature → idempotent upsert (provider event-id UNIQUE) → on paid: створити `Payment(status=confirmed)` + allocation. **Webhook-доставка через outbox** (тема #2).
- **«Оплата з сервісу»**: клієнт у portal на рахунку → `POST /invoices/:id/pay` → createPaymentLink → редірект. Зараз default — manual/по рахунках; провайдери вмикаються per-agency пізніше.

### C. Dunning (авто-нагадування) ✅

- `DunningPolicy { id, agencyId, steps Json }` — `steps: [{offsetDays: -3|0|3|7|14, channel, tone}]` (per-agency у admin).
- Cron `C-dunning` (щодня): для кожного pending/overdue charge надсилає крок, якщо настав його offset від `dueDate` (idempotent — `DunningLog{chargeId, step, sentAt}`). Event `billing.payment_reminder`. Ескалація owner'у на останньому кроці.

### D. Розстрочка / графік оплат ✅

- `PaymentSchedule { id, invoiceId/chargeId, agencyId } + PaymentScheduleItem { scheduleId, dueDate, amount, status(pending|paid|overdue) }`.
- При створенні рахунку owner може розбити на N частин (напр. 50%/50%). Кожен item — окремий «під-charge» для dunning + AR-станів. Оплата зараховується через `PaymentAllocation` на item.

### E. Мультивалютні інвойси ✅ (= арх. тема #11)

- `Document/ServiceCharge.currency` (валюта виставлення: UAH/USD/EUR) + `amountNative`; `amountUsd` (нормалізація для звітів) + `rateUsed` (FX на дату). Клієнт бачить рахунок у своїй валюті; owner-звіти — USD. `exchange_rates` per-agency.

### Schema-зміни (foundation-міграція)

```
Payment: + amountUsd, amountNative, rateUsed, sourceType, sourceId, taxRatePct, taxAmount, agencyId
ServiceCharge: + baseAmount, discountPct, discountAmount, totalAmount, currency, status+written_off, agencyId
CompanyService: + frequency, nextChargeAt
New: PaymentIntent, ChargeLine(line-items), DunningPolicy, DunningLog, PaymentSchedule(+Item),
     CreditNote/Refund; per-agency PaymentSettings/ExchangeRate
```

> **→ BACKLOG (не обрано):** купони/промокоди; LiqPay-адаптер.
