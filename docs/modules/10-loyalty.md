# LOYALTY MODULE

> App: API + Portal
> Статус: MVP (%discount tiers — не points/cashback)
> Залежить від: `packages/db`, `packages/types`
> Оновлено: 27 травня 2026

---

## Огляд

Програма лояльності побудована на **% знижки за тіром компанії**. Тір автоматично перераховується нічним кроном C16 на базі lifetime paid amount.

**Важливо:** ми **НЕ використовуємо** points/cashback модель. У `LoyaltyTier` колишні `BRONZE/SILVER/GOLD/PLATINUM` замінено на `NEW/REGULAR/PARTNER/VIP`. Старий `cashbackPercent` поле в Company залишилось як `bonusBalance` для legacy referral бонусів, але новий код використовує лише `loyaltyTier` + discount calculation.

---

## Тіри

З `@workflo/types`:

| Tier      | Threshold (USD lifetime) | Discount % |
| --------- | -----------------------: | ---------: |
| `NEW`     |                        0 |         0% |
| `REGULAR` |                    1 000 |         3% |
| `PARTNER` |                    5 000 |         7% |
| `VIP`     |                   15 000 |        12% |

Константи: `LOYALTY_TIER_THRESHOLDS_USD` + `LOYALTY_DISCOUNT_PCT` у `packages/types/src/constants.ts`.

Helper: `calculateLoyaltyTier(lifetimePaidUsd: number): LoyaltyTier`.

---

## Розрахунок tier

```sql
-- Lifetime paid = сума всіх paid payments конвертована в USD за exchange_rate на дату payment.
SELECT
  c.id,
  SUM(p.amount_usd) AS lifetime_paid_usd
FROM companies c
JOIN payments p ON p.company_id = c.id AND p.status = 'confirmed'
GROUP BY c.id;
```

Cron `C16:loyalty_recalc`:

- Виконується щодня о 02:30.
- Для кожної компанії перераховує lifetime + порівнює з threshold.
- Якщо tier upgraded → надсилає `loyalty.tier_upgraded` event (з матриці preferences).
- Якщо downgraded — **не downgrade автоматично**. Tier тільки росте (один з принципів програми — бути нагородою). Manual downgrade тільки через admin action з justification.

---

## Застосування знижки до інвойсу

При створенні інвойсу:

```typescript
const company = await prisma.company.findUnique({ where: { id }, select: { loyaltyTier: true } })
const baseAmount = computeBaseAmount(items)
const discountPct = LOYALTY_DISCOUNT_PCT[company.loyaltyTier] // 0 / 3 / 7 / 12
const discount = baseAmount * (discountPct / 100)
const finalAmount = baseAmount - discount

await prisma.serviceCharge.create({
  data: {
    companyId: id,
    baseAmount,
    discountPct,
    discountAmount: discount,
    totalAmount: finalAmount,
    // ...
  },
})
```

Owner може **відмінити знижку** для конкретного інвойсу (override у workspace), але це логується в audit_logs з reason.

---

## Endpoint API

| Method | Path                                       | Auth    | Опис                                                       |
| ------ | ------------------------------------------ | ------- | ---------------------------------------------------------- |
| `GET`  | `/companies/:id/loyalty`                   | owner   | Поточний tier + progress до next tier + history upgrade-ів |
| `GET`  | `/loyalty/tiers`                           | client+ | Публічний опис всіх tier-ів (для UI)                       |
| `POST` | `/companies/:id/loyalty/override-discount` | admin   | Manual tier set (rare; audit-logged)                       |

Response `GET /companies/:id/loyalty`:

```json
{
  "tier": "PARTNER",
  "discountPct": 7,
  "lifetimePaidUsd": 7250.0,
  "nextTier": {
    "name": "VIP",
    "thresholdUsd": 15000,
    "remainingUsd": 7750.0,
    "discountPct": 12
  },
  "upgradeHistory": [
    { "to": "REGULAR", "at": "2025-08-12T10:00:00Z" },
    { "to": "PARTNER", "at": "2026-02-03T03:00:00Z" }
  ]
}
```

---

## UI у Portal

Сторінка `/portal/loyalty`:

- Картка з поточним tier (icon + name + discount%).
- Progress bar до next tier.
- "До VIP залишилось $7,750".
- Список переваг кожного tier ("Безкоштовний consultation для VIP", etc).
- Кнопка "Поділитися реферальним кодом" → перехід до `/portal/referrals`.

---

## Notification: `loyalty.tier_upgraded`

Templates у `@workflo/notifications`:

- **Email**: повноцінне HTML з картинкою tier badge + опис нових переваг.
- **Telegram**: коротко "🎉 Вашу компанію {name} переведено на тір {tier}! Знижка {pct}% автоматично застосована до нових рахунків."
- **in_app**: badge + toast notification.

Тригер: cron C16, тільки коли tier дійсно змінився (порівняння до/після).

---

## Edge cases

- **Партнерська компанія знижує оборот** → tier зберігається (не downgrade автоматично).
- **Тестова знижка від admin** → admin override записує `tierOverride` колонку, яка має пріоритет над автоматичним розрахунком, до next manual reset.
- **Multi-company per profile** → tier per company, **не per profile**. Якщо profile має 3 компанії — кожна має свій tier.

---

## Колонки в `Company`

```prisma
model Company {
  // ...
  loyaltyTier  LoyaltyTier @default(new)
  totalSpent   Decimal     @default(0) @db.Decimal(12, 2)  // legacy; кешуємо lifetime
  bonusBalance Decimal     @default(0) @db.Decimal(12, 2)  // legacy referral balance
  // ...
}
```

`totalSpent` — кеш суми paid; оновлюється кроном C16 синхронно з tier. Зберігаємо щоб не обчислювати в hot path.

---

## Аудит-фіналізація (30 травня 2026) — reconcile (нові фічі не обрано)

> Genuine-фіч не додаємо; лише виправлення.

- **Узгодити тіри (КРИТИЧНО)**: 05-billing каже $500/$2k/$5k @ 0/5/10/15%, 10-loyalty каже $1k/$5k/$15k @ 0/3/7/12% — **дві різні машини на одній колонці**. Джерело істини = **constants у `@workflo/types`** (LOYALTY_TIER_THRESHOLDS_USD + LOYALTY_DISCOUNT_PCT, які вже існують: 0/1k/5k/15k @ 0/3/7/12). Привести 05-billing до цього.
- `ServiceCharge.{baseAmount,discountPct,discountAmount,totalAmount}` — щоб зберігати breakdown знижки.
- `Company.tierOverride` колонка (manual override; cron C16 не клобберить активний override).
- `LoyaltyTierHistory { companyId, fromTier, toTier, at }` — для `upgradeHistory` у `GET /loyalty`.
- Один writer для `totalSpent` (cron, не +increment у payment-шляху). Refund → виключати з lifetime.
- **Precedence** (записати): порядок discount → tax → bonus-debit на одному інвойсі.
- Per-agency loyalty constants (multi-agency, пізніше).

```
ServiceCharge: + baseAmount, discountPct, discountAmount, totalAmount
Company: + tierOverride
New: LoyaltyTierHistory
```
