# CLIENT FINANCIAL ACCOUNT (WALLET) MODULE

> App: Portal (клієнт бачить свої рахунки) + Workspace (owner/admin керує)
> Статус: Проєктування — bonus ledger + admin зараз; money-account + спендинг разом з білінгом (S5)
> Залежить від: `09-referral` (кредити бонусів), `05-billing` (charges/payments), `06-documents` (інвойси), `21-system-monitoring` (audit)
> Оновлено: 29 травня 2026

---

## Огляд

Фінансовий центр компанії-клієнта — **ДВА рахунки** з повною історією:

1. **Бонусний рахунок** (`bonus`) — бонуси з рефералів + ручні корекції. Можна списувати на оплату (S5). Ledger = `WalletTransaction`.
2. **Грошовий рахунок** (`money` / AR — accounts receivable) — реальні гроші: виставлені рахунки (борг), отримані платежі, **куди кожен платіж зараховано**, та похідні стани: **переплата** (prepaid credit), **очікування оплати**, **часткова / неповна оплата**. Повна історія рахунків і платежів клієнта.

Однакова картина у двох ролях:

- **Клієнт** (Portal `/wallet`) — бачить свої 2 баланси + повну історію «що нарахували, що сплатив, куди пішло».
- **Admin** (Workspace `/admin/wallet`) — те саме по будь-якій компанії: всі суми, звідки взялися, куди зараховані, хто винен / хто переплатив.

`Company.bonusBalance` = кеш бонусного балансу; `Company.moneyBalance` (нове) = кеш грошового сальдо (− = винен, + = переплата). Джерело істини — ledger-таблиці; кеші оновлюються атомарно.

**Рішення власника (29.05):** bonus ledger + адмін + редаговані % проєктуємо зараз; money-account (AR + allocations + переплати) і списання бонусів — у S5 разом з invoice-flow (бо без рахунків немає що зараховувати).

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

## Грошовий рахунок (money / AR) — S5

Будується на наявних `ServiceCharge`/`Document(invoice)` (борг клієнта) + `Payment` (надходження) + новій `PaymentAllocation` (куди зараховано). Не дублює їх — додає зв'язок і похідні стани.

### PaymentAllocation — «куди зараховано платіж»

Один платіж може покрити кілька рахунків; один рахунок — кількома платежами (часткова оплата). Залишок платежу, не прив'язаний до жодного рахунку → **переплата (prepaid credit)**.

```prisma
model PaymentAllocation {
  id        String   @id @default(uuid())
  paymentId String
  payment   Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  chargeId  String                       // ServiceCharge або Document(invoice) id
  amount    Decimal  @db.Decimal(12, 2)  // скільки цього платежу пішло на цей рахунок
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  @@index([paymentId])
  @@index([chargeId])
  @@map("payment_allocations")
}
```

- `Σ allocation.amount(payment)` ≤ `payment.amount`. Залишок `payment.amount − Σallocations` = аванс без прив'язки → prepaid credit (+ до moneyBalance).
- `Σ allocation.amount(charge)` vs `charge.amount` → визначає стан рахунку.

### Похідні стани рахунку (для відображення)

| Стан                      | Умова                                         |
| ------------------------- | --------------------------------------------- |
| **awaiting** (очікує)     | charge.status=pending, Σalloc = 0             |
| **partial** (часткова)    | 0 < Σalloc < charge.amount                    |
| **paid** (оплачено)       | Σalloc ≥ charge.amount                        |
| **overdue** (прострочено) | awaiting/partial і dueDate < now()            |
| **overpaid** (переплата)  | Σ payments − Σ charges > 0 → moneyBalance > 0 |

`Company.moneyBalance` (новий кеш) = `Σ confirmed payments − Σ issued charges`. Від'ємний → клієнт винен; додатній → переплата (зараховується на майбутні рахунки).

### Зарахування переплати

Prepaid credit (moneyBalance > 0) автоматично пропонується на нові `ServiceCharge`: створюється `PaymentAllocation` з авансового залишку. Реалізація — S5.

---

## Виписка (statement) — обидва рахунки разом

`GET /wallet/statement?from=&to=` (клієнт) / `GET /admin/wallet/companies/:id/statement` (admin) — зведена історія обох рахунків в одній стрічці:

```json
{
  "bonus": { "balance": "47.50" },
  "money": { "balance": "-120.00", "status": "owes" },
  "timeline": [
    {
      "kind": "charge",
      "date": "2026-04-01",
      "title": "Інвойс INV-2026-001",
      "amount": "-200.00",
      "state": "partial"
    },
    {
      "kind": "payment",
      "date": "2026-04-03",
      "title": "Оплата (картка)",
      "amount": "+80.00",
      "allocatedTo": ["INV-2026-001"]
    },
    {
      "kind": "bonus",
      "date": "2026-04-05",
      "title": "Реферальний бонус",
      "amount": "+47.50",
      "account": "bonus"
    }
  ]
}
```

Admin-вид ідентичний + фільтр по компанії + трасування «звідки взялося» (sourceId кожного руху). Це і є «повне розуміння всіх сум: що, де, як і звідки» для адміна.

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
