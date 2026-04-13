# LOYALTY & BONUSES MODULE
> App: Portal (app.workflo.space) / Workspace (work.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/notifications`
> Оновлено: 12 квітня 2026

---

## Огляд

Система лояльності для клієнтів. Клієнти отримують бонусні бали за активність та оплати. Бали можна витрачати як знижку при наступних замовленнях. Система мотивує клієнтів повертатися та платити вчасно.

---

## Механіка нарахування балів

| Подія | Бали |
|---|---|
| Перше замовлення | +100 |
| Оплата замовлення (кожні $100) | +10 |
| Замовлення закрито без затримки (≤ dueDate) | +25 |
| Залишення відгуку (Phase 2) | +20 |
| Реферал активований | +50 (за кожного) |
| День народження компанії (річниця реєстрації) | +30 |

### Розрахунок балів при оплаті

```typescript
const pointsForPayment = Math.floor(payment.amountUsd / 100) * 10
// $350 → 3 * 10 = 30 балів
// $99 → 0 балів
```

---

## Витрата балів

- 1 бал = $0.01 (1 цент знижки)
- Максимальна знижка балами: **30% від суми замовлення**
- Мінімальна кількість балів для використання: **50 балів**

```typescript
// При оплаті замовлення
const maxPointsDiscount = Math.floor(order.totalAmount * 0.30 * 100)  // 30% в балах ($1 = 100 балів)
// Але у нас 1 бал = $0.01, тому:
const maxDiscount = order.totalAmount * 0.30  // USD
const pointsNeeded = Math.ceil(requestedDiscount * 100)  // скільки балів витратити
```

---

## Тайєри (рівні лояльності)

| Тайєр | Назва | Умова | Множник балів |
|---|---|---|---|
| 1 | Bronze | 0–499 балів | ×1.0 |
| 2 | Silver | 500–1999 балів | ×1.2 |
| 3 | Gold | 2000–4999 балів | ×1.5 |
| 4 | Platinum | 5000+ балів | ×2.0 |

Тайєр визначається за `totalEarned` (загальна кількість зароблених балів за весь час, не поточний баланс).

```typescript
function getTier(totalEarned: number): LoyaltyTier {
  if (totalEarned >= 5000) return 'platinum'
  if (totalEarned >= 2000) return 'gold'
  if (totalEarned >= 500) return 'silver'
  return 'bronze'
}
```

---

## Термін дії балів

- Бали не мають терміну дії в MVP
- Phase 2: опціональний термін 12 місяців з дати нарахування

---

## DB Schema

```prisma
model LoyaltyAccount {
  id           String   @id @default(uuid())
  companyId    String   @unique
  balance      Int      @default(0)  // поточний баланс (може зменшуватися)
  totalEarned  Int      @default(0)  // накопичувально (тільки росте)
  tier         String   @default("bronze")  // bronze|silver|gold|platinum
  updatedAt    DateTime @updatedAt

  company      Company          @relation(fields: [companyId], references: [id])
  transactions LoyaltyTransaction[]
}

model LoyaltyTransaction {
  id          String   @id @default(uuid())
  accountId   String
  type        String   // 'earn' | 'spend' | 'expire' | 'refund'
  points      Int      // позитивне (earn) або від'ємне (spend)
  reason      String   // 'payment' | 'first_order' | 'referral' | 'birthday' | 'manual' | 'discount_applied'
  orderId     String?
  paymentId   String?
  meta        Json?    // додаткова інфо
  createdAt   DateTime @default(now())

  account LoyaltyAccount @relation(fields: [accountId], references: [id])

  @@index([accountId, createdAt])
}
```

---

## Бізнес-логіка нарахування

```typescript
// packages/types/src/loyalty.ts
export const LOYALTY_EVENTS = {
  FIRST_ORDER: 100,
  PAYMENT_PER_100_USD: 10,
  ORDER_ON_TIME: 25,
  REFERRAL_ACTIVATED: 50,
  ANNIVERSARY: 30,
} as const

// В API при підтвердженні оплати:
export async function awardPaymentPoints(paymentId: string): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } })
  const account = await db.loyaltyAccount.findUnique({ where: { companyId: payment.order.companyId } })

  const basePoints = Math.floor(payment.amountUsd / 100) * LOYALTY_EVENTS.PAYMENT_PER_100_USD
  const multiplier = TIER_MULTIPLIERS[account.tier]
  const finalPoints = Math.round(basePoints * multiplier)

  if (finalPoints > 0) {
    await db.$transaction([
      db.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: finalPoints },
          totalEarned: { increment: finalPoints },
          tier: getTier(account.totalEarned + finalPoints),
        },
      }),
      db.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: 'earn',
          points: finalPoints,
          reason: 'payment',
          paymentId,
        },
      }),
    ])
  }
}
```

---

## API Endpoints

| Метод | URL | Хто | Опис |
|---|---|---|---|
| `GET` | `/loyalty` | Portal | Баланс, тайєр, статистика |
| `GET` | `/loyalty/transactions` | Portal | Історія транзакцій |
| `POST` | `/loyalty/apply` | Portal | Застосувати бали до замовлення |
| `GET` | `/loyalty/companies` | Workspace | Список компаній з балансом |
| `POST` | `/loyalty/adjust` | Workspace (Owner) | Ручне коригування балів |

---

## DTO

### `GET /loyalty` Response

```typescript
{
  balance: number           // поточний баланс
  totalEarned: number       // всього зароблено
  tier: 'bronze'|'silver'|'gold'|'platinum'
  tierMultiplier: number    // 1.0 | 1.2 | 1.5 | 2.0
  nextTier: {
    name: string
    pointsNeeded: number    // скільки ще потрібно totalEarned до наступного тайєру
  } | null
  maxDiscount: number       // максимальна знижка балами (30% правило)
}
```

### `GET /loyalty/transactions` Response

```typescript
{
  items: {
    id: string
    type: 'earn' | 'spend' | 'refund'
    points: number          // + або -
    reason: string
    orderId: string | null
    createdAt: string
  }[]
  total: number
}
```

### `POST /loyalty/apply`

```typescript
// Request
{
  orderId: string
  points: number    // кількість балів для застосування
}

// Response
{
  appliedPoints: number
  discountAmount: number   // USD
  newBalance: number
}
```

### `POST /loyalty/adjust` (тільки Owner/Workspace)

```typescript
{
  companyId: string
  points: number          // може бути від'ємним
  reason: string          // 'manual_correction' | 'compensation' | 'promotion'
  comment?: string
}
```

---

## UI (Portal)

- Блок "Мої бонуси" на dashboard
- Прогрес-бар до наступного тайєру
- Значок тайєру біля імені компанії
- При оплаті — чекбокс "Використати бали" з полем кількості

## UI (Workspace)

- Стовпець "Тайєр" в списку компаній
- Таб "Лояльність" в картці компанії з деталями
- Кнопка ручного коригування

---

## Нотифікації

| Подія | Кому | Канал |
|---|---|---|
| Нарахування балів (> 0) | Company Owner | Telegram |
| Досягнення нового тайєру | Company Owner | Email + Telegram |
| Витрата балів | Company Owner | Telegram |

---

## Зв'язки з іншими модулями

| Модуль | Зв'язок |
|---|---|
| **Orders** | Бали за замовлення в строк |
| **Billing** | Бали за оплати, знижка балами |
| **Referral** | Бали за активованих рефералів |
| **Notifications** | Повідомлення про нарахування/тайєр |
