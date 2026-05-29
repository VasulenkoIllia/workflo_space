# CLIENT WALLET MODULE

> App: Portal (клієнт бачить свій баланс) + Workspace (owner/admin керує)
> Статус: Проєктування — ledger + admin зараз (S5-сусід), спендинг разом з білінгом (S5)
> Залежить від: `09-referral` (джерело кредитів), `05-billing` (спендинг), `21-system-monitoring` (audit)
> Оновлено: 29 травня 2026

---

## Огляд

**Гаманець компанії-клієнта** — єдиний баланс бонусів з повним журналом транзакцій (ledger). Кошти **нараховуються** (кредити) з реферальної програми та ручних коригувань адміна; **списуються** (дебети) на оплату замовлень (реалізація списання — у S5 разом з invoice-flow).

Замінює модель «баланс = одне число»: `Company.bonusBalance` лишається **кешем поточного балансу**, а `WalletTransaction` — джерелом істини (ledger), щоб була історія і point-in-time баланс.

**Рішення власника (29.05):** ledger + адмін-екран + редаговані % робимо зараз (проєктування), фактичне СПИСАННЯ на оплату — у S5, бо немає куди списувати поки немає invoice-flow.

---

## Модель даних

```prisma
enum WalletTxnType {
  credit   // надходження (+)
  debit    // списання (−)
}

enum WalletTxnSource {
  referral_bonus     // credit — нарахування з реферала (модуль 09)
  manual_adjustment  // credit/debit — ручна корекція адміном
  invoice_payment    // debit — оплата замовлення бонусами (S5)
  refund             // credit — повернення списаного
}

/// Журнал руху коштів гаманця. Append-only (не редагуємо/не видаляємо рядки —
/// корекція = новий рядок). bonusBalance у Company = кеш SUM(credit) − SUM(debit).
model WalletTransaction {
  id           String          @id @default(uuid())
  companyId    String
  company      Company         @relation(fields: [companyId], references: [id], onDelete: Cascade)
  type         WalletTxnType
  source       WalletTxnSource
  amount       Decimal         @db.Decimal(12, 2) // завжди > 0; напрям задає type
  balanceAfter Decimal         @db.Decimal(12, 2) // знімок балансу після транзакції
  currency     String          @default("USD")
  sourceId     String?         // referralBonusId / paymentId / invoiceId — трасування
  note         String?         // обовʼязковий для manual_adjustment
  createdById  String?         // адмін, що зробив ручну корекцію
  createdBy    Profile?        @relation("WalletTxnCreatedBy", fields: [createdById], references: [id])
  createdAt    DateTime        @default(now()) @db.Timestamptz(3)

  @@index([companyId, createdAt])
  @@index([source])
  @@map("wallet_transactions")
}
```

### Інваріант

`Company.bonusBalance == SUM(credit.amount) − SUM(debit.amount)` для компанії. Кожна зміна балансу — атомарна транзакція: `INSERT WalletTransaction` + `UPDATE company.bonusBalance` в одному `$transaction`. `balanceAfter` пишемо з обчисленого нового балансу (під `SELECT ... FOR UPDATE` на company, щоб уникнути гонки — як у payment race guard, модуль 05).

---

## Редаговані реферальні відсотки (ReferralSettings)

Раніше `REFERRAL_TIERS` були зашиті в код. Тепер — у БД, редаговані адміном:

```prisma
model ReferralSettings {
  id        String   @id @default("singleton")
  enabled   Boolean  @default(true)
  tiers     Json     @default("[{\"minEarned\":0,\"percent\":10},{\"minEarned\":500,\"percent\":12},{\"minEarned\":2000,\"percent\":15}]")
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  updatedBy String?

  @@map("referral_settings")
}
```

- `REFERRAL_TIERS` у `@workflo/types/constants` стає **дефолтним сидом** (seed пише singleton-рядок).
- `getReferralPercent()` читає `ReferralSettings.tiers` (з кешем 5хв), а не константу.
- Зміна тірів адміном → audit_logs `referral.tiers_updated` + не зачіпає вже нараховані бонуси (історичні `ReferralBonus.percent` лишаються).

---

## Endpoints

### Portal (клієнт — owner компанії)

| Method | Path                               | Опис                                                   |
| ------ | ---------------------------------- | ------------------------------------------------------ |
| `GET`  | `/wallet`                          | Поточний баланс + пагінований ledger (свої транзакції) |
| `GET`  | `/wallet/transactions?page=&type=` | Історія транзакцій компанії                            |

### Workspace (admin)

| Method  | Path                                              | Auth          | Опис                                                        |
| ------- | ------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| `GET`   | `/admin/wallet/companies?search=`                 | admin/finance | Список компаній з балансами + сумарна liability             |
| `GET`   | `/admin/wallet/companies/:companyId/transactions` | admin/finance | Ledger конкретної компанії                                  |
| `POST`  | `/admin/wallet/companies/:companyId/adjust`       | admin/finance | Ручна корекція `{ type, amount, note }` (note обовʼязковий) |
| `GET`   | `/admin/referral/settings`                        | admin         | Поточні тіри + enabled                                      |
| `PATCH` | `/admin/referral/settings`                        | admin         | Редагувати тіри / enabled                                   |

Authz: `can(user, 'finance.read' / 'finance.write')` (ADR-002; зараз — admin email, далі — RBAC).

---

## Кредит з реферала (інтеграція з модулем 09)

`processReferralBonus()` (модуль 09) тепер замість прямого `increment bonusBalance` пише через wallet-сервіс:

```typescript
await walletCredit(tx, {
  companyId: referrerCompanyId,
  source: 'referral_bonus',
  amount: bonusAmount,
  sourceId: referralBonus.id,
})
// walletCredit: lock company FOR UPDATE → newBalance = balance + amount
//   → INSERT WalletTransaction(credit, balanceAfter=newBalance)
//   → UPDATE company.bonusBalance = newBalance
```

Нотифікація `loyalty.discount_applied` / окремий `wallet.credited` event (категорія billing/loyalty).

---

## Списання на оплату (S5 — разом з білінгом)

Коли зʼявиться invoice-flow (модуль 05/S5):

- На екрані оплати замовлення клієнт може «Використати бонуси: до $X».
- `walletDebit(tx, { companyId, source: 'invoice_payment', amount, sourceId: invoiceId })` → дебет + зменшення суми до сплати.
- Guard: `amount ≤ bonusBalance`; атомарно з підтвердженням платежу.
- Відмова/повернення → `refund` credit.

**Не реалізуємо до S5** — немає invoice-flow. Зараз лише проєктуємо API-форму, щоб ledger був готовий.

---

## Admin UI — `/workspace/admin/wallet`

```
┌─ Гаманці клієнтів ─────────────────────────────────┐
│ [пошук компанії]              Liability: $1,240.50 │
│ ┌────────────┬──────────┬──────────────────────┐  │
│ │ Компанія   │ Баланс   │ Дії                  │  │
│ │ ТОВ Ромашка│ $47.50   │ [Історія] [Корекція] │  │
│ └────────────┴──────────┴──────────────────────┘  │
│                                                    │
│ Історія (ТОВ Ромашка):                             │
│  +$47.50  referral_bonus  bal $47.50  15.03        │
│  +$10.00  manual_adjust   bal $57.50  20.03 (note) │
│  −$30.00  invoice_payment bal $27.50  01.04 (S5)   │
│                                                    │
│ [Реферальні відсотки →] (редагування тірів)        │
└────────────────────────────────────────────────────┘
```

---

## Audit

- `wallet.manual_adjustment` (actor, companyId, type, amount, note)
- `wallet.credited` / `wallet.debited` (source, amount)
- `referral.tiers_updated` (old → new)

## Retention

WalletTransaction — **forever** (фінансова історія, як payments; див. RETENTION.md).

## Acceptance (ця фаза — без спендингу)

- [ ] WalletTransaction ledger + інваріант balance == SUM(credits)−SUM(debits).
- [ ] Реферальні нарахування пишуться як credit-транзакції.
- [ ] ReferralSettings у БД, % редаговані адміном (тіри з кешем).
- [ ] Admin: список гаманців + історія + ручна корекція (audit).
- [ ] Portal: клієнт бачить баланс + свою історію.
- [ ] Spending API спроєктований, помічений S5.
