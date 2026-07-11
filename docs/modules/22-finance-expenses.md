# FINANCE / EXPENSES MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> ✅ **S13-06ч ПОДАТОК-НА-ДОХІД (2026-07-11, Enhancement №1):** модель власника (18.06, НЕ ПДВ) —
> податок = % від отриманих платежів per-юр-особа/канал (ФОП 5% / крипта 0%). `LegalEntity.incomeTaxPct`
>
> - `Payment.legalEntityId` (каскад при confirm: явний → проєкт → дефолтна; легасі NULL = без податку;
>   міграція `20260714_income_tax`). P&L: лінія `income_tax` = (confirmed − refund-клавбек, М-1 фільтр) × ставка;
>   period-семантика (відʼємний податок-кредит можливий); bonus-платежі не оподатковуються. Маржа свідомо
>   до-податкова (accrual vs cash). UI: ставка у формі юр-особи, селект отримувача в платіж-модалці,
>   стат/донат-категорія на /finance. Лишок S13-06: receipts/budgets/approval, класичний VAT.
>
> App: Workspace (owner-only)
> Статус: Проєктування (заплановано після S1 Auth) — реалізація поетапна
> Залежить від: `packages/db`, `05-billing`, `12-team-executors`, `19-reports`
> Оновлено: 29 травня 2026

---

> 🔄 **design-v2 (2026-06-20):** доставлено **margin** (breakdown by client/project/executor + FX-снапшот) та **fin-projects** (фінмодель 2.0): [`workspace-margin.jsx`](../../design-v2/project/workspace-margin.jsx), [`workspace-finprojects.jsx`](../../design-v2/project/workspace-finprojects.jsx) + data. 🟢 **core бекенд є** (звірено): `finance/margin.ts` (`computeProjectMargin/ClientMargin`) + `billing/projects.ts` CRUD. Gap: TeamCompensation/ContractTemplate бекенди. Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).

## Огляд

Модуль обліку **витрат** і розрахунку **прибутковості** (P&L — Profit & Loss).

**Проблема, яку вирішує:** зараз система бачить тільки доходи (payments) і частково ЗП через `ExecutorRate × години`. Немає де записати реальні витрати — сервери, підписки (Claude, ін.), фіксовані зарплати, оренда, разові закупівлі. Тому owner не бачить **справжній прибуток**.

**Сценарій-приклад (від власника):** «Купую 1 сервер за $30/міс, але продаю його на 10 клієнтів по $10. Хочу вводити щомісячні/разові витрати і бачити дохід та прибуток. ЗП працівникам — теж моя витрата. Має працювати в розрізі і клієнтів, і працівників.»

**Рішення (узгоджено):** реалізуємо **поетапно**:

- **Фаза 1** — загальний P&L: реєстр витрат + звіт `Дохід − Витрати = Прибуток` з розбивкою по категоріях + тегами клієнт/працівник.
- **Фаза 2** — маржа по кожному клієнту: розподіл спільних витрат (1 сервер → N клієнтів) → прибуток окремо по клієнту.

---

## ФАЗА 1 — Загальний P&L

### Модель даних

```prisma
enum ExpenseType {
  recurring   // повторюється (щомісяця / квартал / рік)
  one_time    // разова
}

enum ExpenseCategory {
  infrastructure   // сервери, хостинг, домени
  software         // підписки (Claude, Figma, ...)
  salary           // зарплати
  contractor       // підрядники (не штат)
  rent             // оренда
  tax              // податки/збори
  marketing        // реклама
  other
}

enum ExpenseFrequency {
  monthly
  quarterly
  annual
}

model Expense {
  id            String           @id @default(uuid())
  type          ExpenseType
  category      ExpenseCategory
  name          String           // "Hetzner CX21", "Claude Pro", "ЗП Олена"
  vendor        String?          // постачальник
  amount        Decimal          @db.Decimal(12, 2)
  currency      String           @default("USD")
  amountUsd     Decimal          @db.Decimal(12, 2) // нормалізовано на дату через exchange_rates

  // для recurring:
  frequency     ExpenseFrequency?
  startDate     DateTime         @db.Timestamptz(3)
  endDate       DateTime?        @db.Timestamptz(3) // null = активна досі

  // для one_time: дата = startDate, frequency = null

  // теги (опційно) — для розбивки у звіті:
  linkedExecutorId String?       // якщо це ЗП конкретного працівника
  linkedExecutor   Profile?      @relation("ExpenseExecutor", fields: [linkedExecutorId], references: [id])
  linkedCompanyId  String?       // якщо витрата прямо стосується 1 клієнта
  linkedCompany    Company?      @relation(fields: [linkedCompanyId], references: [id])

  // службове джерело (щоб не дублювати ЗП):
  source        String           @default("manual") // 'manual' | 'executor_rate'
  sourceRef     String?          // executorRateId якщо source='executor_rate'

  notes         String?
  isActive      Boolean          @default(true)
  createdById   String
  createdBy     Profile          @relation("ExpenseCreatedBy", fields: [createdById], references: [id])
  createdAt     DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime         @updatedAt @db.Timestamptz(3)

  @@index([type, category])
  @@index([startDate])
  @@index([linkedCompanyId])
  @@index([linkedExecutorId])
  @@map("expenses")
}
```

### Зарплати — без подвійного вводу

`ExecutorRate` (модуль 12) лишається **джерелом істини** для оплати штату. Модуль фінансів **автоматично** включає активні ЗП у P&L як рядки `category=salary, source='executor_rate'`:

- При розрахунку P&L за період беремо суму `ExecutorRate.monthlySalaryUsd` для активних ставок (`effectiveFrom ≤ період ≤ effectiveUntil`) → стаття `salary`.
- **Погодинна собівартість праці (ХВІСТ-3, 07.07):** для виконавців БЕЗ активного окладу у періоді — Σ(`TimeLog.hours × costRateUsd`) → окрема стаття `labor_hourly`. Виконавці з окладом ВИКЛЮЧАються (їхній час покритий окладом → без подвійного рахунку).
- Owner **не вводить ЗП штату вручну** — лише підрядників / разові виплати (`source='manual', category=contractor`).
- Тепер P&L покриває і фіксовану (оклад), і погодинну (labor_hourly) працю — раніше погодинники давали 0 у витратах.

### Нормалізація суми періоду

P&L рахується за календарний місяць. Витрати приводяться до місяця:

- `monthly` → `amountUsd`
- `quarterly` → `amountUsd / 3`
- `annual` → `amountUsd / 12`
- `one_time` → повна сума у місяці `startDate` (не розмазується)

`amountUsd` фіксується на дату вводу через `exchange_rates` (стабільність історії, як у payments).

### P&L звіт (Фаза 1)

`GET /reports/pnl?from=2026-05-01&to=2026-05-31&groupBy=month|category`

```sql
-- Доходи (вже є з модуля 19)
WITH revenue AS (
  SELECT date_trunc('month', confirmed_at) AS period, SUM(amount_usd) AS revenue_usd
  FROM payments WHERE status='confirmed' AND confirmed_at BETWEEN $from AND $to
  GROUP BY period
),
-- Витрати: recurring нормалізовані + one_time + ЗП штату
expenses AS (
  SELECT period, category, SUM(monthly_usd) AS expense_usd FROM (...) GROUP BY period, category
)
SELECT r.period,
       r.revenue_usd,
       COALESCE(SUM(e.expense_usd), 0) AS total_expenses_usd,
       r.revenue_usd - COALESCE(SUM(e.expense_usd), 0) AS net_profit_usd
FROM revenue r LEFT JOIN expenses e ON e.period = r.period
GROUP BY r.period, r.revenue_usd;
```

**Response:**

```json
{
  "period": "2026-05",
  "revenueUsd": 100.0,
  "expenses": {
    "infrastructure": 30.0,
    "software": 20.0,
    "salary": 40.0,
    "total": 90.0
  },
  "netProfitUsd": 10.0,
  "marginPct": 10.0
}
```

### Endpoints (Фаза 1)

| Method   | Path                    | Auth  | Опис                                                              |
| -------- | ----------------------- | ----- | ----------------------------------------------------------------- |
| `GET`    | `/expenses`             | owner | Список (фільтр type/category/active/linkedCompany/linkedExecutor) |
| `POST`   | `/expenses`             | owner | Створити (recurring / one_time)                                   |
| `PUT`    | `/expenses/:id`         | owner | Редагувати                                                        |
| `POST`   | `/expenses/:id/archive` | owner | Деактивувати (isActive=false; історія зберігається)               |
| `DELETE` | `/expenses/:id`         | owner | Видалити (тільки якщо не входить у вже згенерований звіт)         |
| `GET`    | `/reports/pnl`          | owner | P&L звіт за період                                                |
| `GET`    | `/reports/pnl.csv`      | owner | Експорт                                                           |

`can(user, 'admin.access')` або owner головної компанії.

### UI (Фаза 1) — `/workspace/finance`

```
┌─ Фінанси ──────────────────────────────────┐
│ [Травень 2026 ▾]              [+ Витрата]   │
│                                             │
│  Дохід              $100.00                 │
│  ─────────────────────────────────────     │
│  Infrastructure     −$30.00  (1 поз.)       │
│  Software           −$20.00  (1 поз.)       │
│  Salary             −$40.00  (1 поз.)       │
│  ─────────────────────────────────────     │
│  Витрати разом      −$90.00                 │
│  ═════════════════════════════════════     │
│  Чистий прибуток     $10.00  (10%)          │
│                                             │
│  [Витрати] [Графік P&L] [Експорт CSV]       │
└─────────────────────────────────────────────┘
```

Вкладка «Витрати» — таблиця всіх expense з inline-фільтрами; «Графік P&L» — лінія дохід/витрати/прибуток по місяцях.

### Cron

- `C20:expense_recurring_marker` (опційно) — не створює рядки, P&L рахується «на льоту» з recurring + дат. Тобто recurring expense — це **одна** строка з frequency, а не N згенерованих. Просто.

---

## ФАЗА 2 — Маржа по клієнтах (cost allocation)

> Реалізуємо пізніше, коли реєстр витрат заповнений реальними даними.

### Ідея

Спільні витрати (1 сервер $30 на 10 клієнтів) розподіляються між клієнтами, щоб бачити **прибуток окремо по кожному клієнту**.

### Модель розподілу

```prisma
enum AllocationMethod {
  equal           // порівну між обраними клієнтами
  weighted        // за вагами (% або частки)
  by_revenue      // пропорційно доходу клієнта за період
  direct          // 100% на 1 клієнта (= linkedCompanyId)
}

model ExpenseAllocation {
  id          String           @id @default(uuid())
  expenseId   String
  expense     Expense          @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  method      AllocationMethod
  // для equal/weighted: явний список компаній + ваг
  targets     Json             // [{ companyId, weight }] або null для by_revenue (всі активні)
  createdAt   DateTime         @default(now()) @db.Timestamptz(3)

  @@map("expense_allocations")
}
```

### Per-client P&L

`GET /reports/pnl/by-client?from=&to=`

Для кожного клієнта:

```
client_revenue − (direct_costs + allocated_share_of_shared_costs) = client_margin
```

де `allocated_share` рахується за method:

- `equal`: `expense_usd / N_targets`
- `weighted`: `expense_usd × weight_i / Σweights`
- `by_revenue`: `expense_usd × client_revenue / total_revenue`

**Response:**

```json
{
  "period": "2026-05",
  "clients": [
    {
      "companyId": "...",
      "name": "Клієнт A",
      "revenueUsd": 10.0,
      "directCostsUsd": 0,
      "allocatedSharedUsd": 3.0, // частка сервера $30/10
      "marginUsd": 7.0,
      "marginPct": 70.0
    }
  ],
  "unallocatedExpensesUsd": 0
}
```

### UI (Фаза 2)

Додаткова вкладка «Маржа по клієнтах» у `/workspace/finance` — таблиця: клієнт / дохід / прямі / розподілені / маржа / маржа %. Сортування за маржею. Підсвічування збиткових клієнтів (margin < 0) червоним.

---

## Зв'язок з іншими модулями

- **19-reports**: P&L — це нова сторінка звіту поруч із time/revenue/debtors. Revenue беремо з тієї самої агрегації payments.
- **12-team-executors**: ЗП штату підтягуються з `ExecutorRate` (без дубля). Підрядники — manual expense.
- **05-billing**: доходи (payments) — джерело revenue для P&L.
- **20-admin-settings**: категорії витрат можна зробити CRUD-таблицею пізніше (зараз enum достатньо).
- **21-system-monitoring**: зміни витрат → audit_logs (`finance.expense_created/updated/deleted`).

---

## Валюта

Усе нормалізується в USD (як у звітах). `amount` + `currency` — як ввів owner; `amountUsd` — конвертовано на дату через `exchange_rates`. Звіти завжди в USD.

---

## Acceptance criteria (Фаза 1)

- [ ] Owner може створити recurring expense (сервер $30/міс) і one_time (домен $12).
- [ ] ЗП штату автоматично у P&L (без ручного вводу).
- [ ] P&L звіт за місяць: дохід − витрати = прибуток + розбивка по категоріях.
- [ ] Фільтр витрат по клієнту/працівнику.
- [ ] CSV експорт.
- [ ] Усі зміни в audit_logs.
- [ ] Витрати в розрізі клієнтів (тег) і працівників (тег/ЗП) — видимі у фільтрах.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

- **`Expense.agencyId`** + `ExpenseAllocation` scoped; `can('finance.read'/'finance.write')` + tenant-guard на всіх `/expenses` та `/reports/pnl*`.
- Усі зміни → `audit_logs` (`finance.expense_created/updated/deleted/archived`).
- `amountUsd` через спільні `exchange_rates` (як payments) — джерело курсу одне.

### B. Прикріплення чеків/інвойсів ✅

- `ExpenseReceipt { id, expenseId, fileId, sha256 }` (через `packages/storage`, OrderFile-патерн, tenant-prefixed). PDF/фото чека до кожної витрати — критично для бухгалтерії.

### C. Бюджети + алерти перевитрат ✅

- `Budget { agencyId, category, monthlyLimitUsd }`. Cron порівнює факт P&L vs ліміт → `notify('finance.budget_exceeded')`. Проактивний контроль.

### D. Воркфлоу узгодження витрат ✅

- `Expense.status { draft, pending, approved, rejected }` + reviewer (як leave). Лише `approved` потрапляє в P&L. Owner-only затвердження; команда подає.

### E. ПДВ / податковий облік ✅

- `Expense.{ vatRate, deductible }` → податковий звіт (deductible-сума за період). Для агенції-платника податків в Україні.

```
Expense: + agencyId, status, vatRate, deductible
New: ExpenseReceipt, Budget
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                                                                                        | Вплив               | Нюанси власника                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| 22-А | **Повторювані витрати** (автостворення щомісяця/щороку)                                                                                        | [бек] дрібний       | —                                                      |
| 22-Б | **Чеки/інвойси до витрат** (вкладення; піднято з Phase 2)                                                                                      | [бек дрібний+екран] | —                                                      |
| 22-Д | **Cost allocation / маржа — підняти з S13-06 у ядро**: повна собівартість по проєктах/клієнтах (вимагається рішеннями 05-ПРОЕКТИ і 12-РЕФЕРАЛ) | [бек]               | див. «Нюанси власника (канон для margin-движка)» нижче |
| 22-Г | **Cash-flow прогноз** (надходження з нарахувань+payment terms vs витрати, 1-3 міс)                                                             | [бек+екран]         | —                                                      |

### Нюанси власника (канон для margin-движка)

- **Собівартість видима**: адміну агенції (і тенантам на SaaS) видно собівартість послуги/години — загалом і **в розрізі проєкту**.
- **«Нульова собівартість» виконавця**: якщо роботу виконує сам owner — все, що платять за годину, лишається агенції (cost=0). Прапорець «без собівартості / весь дохід агенції» — **у owner-а за замовчуванням, і owner може призначити його будь-кому** (партнери-співвласники).

**Для ТЗ дизайнеру:** форма повторюваної витрати (А); вкладення чеків (Б); розріз собівартість/маржа на екрані проєкту і звітах (Д+нюанси); екран cash-flow (Г).
