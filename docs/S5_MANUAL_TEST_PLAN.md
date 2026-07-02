# Sprint 5 — Покроковий план ручного тестування

> Що і як протестувати з реалізованого фінансового ядра. S5 — **backend-only** (UI для білінгу — окремий фронт-спринт), тож тестуємо через **API** (curl / Postman / Insomnia). S0-S4 (auth, orders, chat, portal/workspace UI) тестуються через браузер як і раніше.
>
> Перед стартом — звір [`SERVER_UPDATE_S5.md`](archive/SERVER_UPDATE_S5.md) (міграція застосована, крони inline, для UAH є `ExchangeRate`).
>
> Позначення: ✅ очікуваний результат · ⛔ негативний кейс (має дати помилку).

---

## 0. Підготовка

```bash
export API=https://dev-api.workflo.space        # staging API (або http://localhost:4000 локально)
# Логін власника агенції → access-токен (refresh — у cookie)
export TOKEN=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"<owner-email>","password":"<pass>"}' | jq -r '.data.accessToken')
echo $TOKEN   # має бути JWT
```

- Заведи (через UI або seed) **2 компанії-клієнти** в агенції (для cross-tenant/referral) і **1 замовлення (order)** з виставленою ціною (`totalAmount`, напр. $1000).
- Запиши `companyId`, `orderId`, `agencyId`. Для негативних кейсів матимеш токени **executor** і **client** (owner іншої компанії).

> Усі workspace-ендпоінти — для команди/власника; portal-ендпоінти — від токена клієнта (його `activeCompanyId`).

---

## 1. Платежі (S5-02) — серце money-path

1. **Підтвердити платіж за замовлення (USD).**
   `POST $API/workspace/billing/payments` з заголовком `Idempotency-Key: $(uuidgen)` і тілом `{"companyId":"...","orderId":"...","amount":400,"type":"advance"}`
   ✅ `201`, у відповіді `newDebt:"600.00"`, `orderPaidAt:null`.
2. **Доплата (final).** Той самий order, новий `Idempotency-Key`, `{"...","amount":600,"type":"final"}`
   ✅ `201`, `newDebt:"0.00"`, `orderPaidAt` ≠ null (замовлення оплачене).
3. **Ідемпотентність (double-submit).** Повтори запит №1 **з тим самим `Idempotency-Key` і тілом**.
   ✅ `201`, **та сама відповідь**, у БД **НЕ зʼявився другий платіж** (`GET /workspace/billing/payments?companyId=...` — кількість незмінна).
4. ⛔ **Reuse ключа з іншим тілом.** Той самий `Idempotency-Key`, але `amount:999`.
   ⛔ `422` (idempotency key reuse).
5. ⛔ **Повторна оплата вже оплаченого order.** Новий ключ, той самий (оплачений) `orderId`.
   ⛔ `409` (замовлення вже оплачено).
6. **UAH-платіж (FX-снапшот).** `{"companyId":"...","amount":4150,"currency":"UAH"}` (потрібен `ExchangeRate`).
   ✅ `201`, `payment.amountUsd` ≈ `100.00` (4150/41.5), `rateUsed` = курс.
   ⛔ Якщо `ExchangeRate` нема → `422` (синхронізуй курс).
7. ⛔ **Сума >2 знаків / 0 / відʼємна** → `400`. **Без `Idempotency-Key`** → `400`.
8. ⛔ **Клієнтський токен** на цьому ендпоінті → `403`. **Чужа агенція `companyId`** → `403`/`404`.
9. **Reads:** `GET /workspace/billing/overview` ✅ дохід + борг + топ-боржники. `GET /portal/billing/summary` (клієнт) ✅ debt/tier/discount/bonus/реквізити.

> **Регресія предиката (важливо!):** перевір, що `amount:1.12` ✅ **приймається** (`201`), а не `400` — це був баг, виправлений в аудиті.

---

## 2. Послуги + рекурентні charge (S5-03b)

1. **Створити послугу.** `POST $API/workspace/services` `{"name":"SEO підписка","defaultPriceUsd":100}` ✅ `201`.
2. **Призначити компанії.** `POST $API/workspace/services/:id/assign` `{"companyId":"...","customPrice":100,"frequency":"monthly"}`
   ✅ `201`, `nextChargeAt` = 1-ше число наступного місяця.
3. ⛔ **Повторне призначення** активної підписки → `409`.
4. **Згенерувати charge вручну (fallback крону).** `POST $API/workspace/billing/charges/generate` `{"month":"2026-06"}`
   ✅ `200` `{created, due}`.
5. **Ідемпотентність.** Повтори №4 з тим самим місяцем → ✅ `created:0` (без дублів).
6. **Перевірити charge.** `GET /portal/billing/charges?month=2026-06` (клієнт) ✅ нарахування з `totalAmount` (зі знижкою лояльності, якщо tier > new).
7. ⛔ **Видалити послугу з активною підпискою** → `409`.

---

## 3. Бонус-гаманець (S5-05)

1. **Нарахувати бонус (owner).** `POST $API/admin/wallet/companies/:companyId/adjust` `{"type":"credit","amount":50,"note":"промо"}` ✅ `201`, `balanceAfter:"50.00"`.
2. **Списати в межах балансу.** `{"type":"debit","amount":20,"note":"корекція"}` ✅ `201`, `balanceAfter:"30.00"`.
3. ⛔ **Овердрафт.** `{"type":"debit","amount":1000,"note":"x"}` → `409` (недостатньо бонусів).
4. ⛔ **Без note** → `400`. **Executor (не owner)** → `403`.
5. **Клієнт бачить свій гаманець.** `GET /portal/wallet` ✅ `bonusBalance:"30.00"`. `GET /portal/wallet/transactions` ✅ леджер (credit/debit).
6. ⛔ **Чужа компанія** в `:companyId` → `404`.

---

## 4. Реферали (S5-06)

1. Признач **компанії B** `referredById` = компанія A (через seed/UI — поле `Company.referredById`).
2. **Платіж компанії B.** Підтверди платіж B на $200 (як у розділі 1).
   ✅ компанії **A** нарахувалось 5% = **$10** бонусу (перевір `GET /portal/wallet` від A, або `/admin/wallet/companies/:A/transactions` → запис `source:referral_bonus`).
3. **Ідемпотентність.** Реферал нараховується **один раз на платіж** (повторна обробка не дублює — гарантовано unique-констрейнтом).
4. ⛔ **Без реферера / програма вимкнена** (`PATCH /admin/referral/settings {"enabled":false}`) → нарахування **нема**, платіж проходить нормально.
5. **Налаштування тірів.** `GET /admin/referral/settings` ✅ дефолтні тіри (0→5%,5k→7%,15k→10%). `PATCH` (owner) — змінити; ⛔ executor → `403`.

---

## 5. Money-account + алокація (S5-07)

1. Маючи **підтверджений платіж без orderId** (advance/prepaid, напр. $100) і **charge** на $100:
   `POST $API/workspace/billing/payments/:paymentId/allocate` (без тіла = FIFO, або `{"allocations":[{"chargeId":"...","amount":100}]}`)
   ✅ `200`, charge → `paid`, `moneyBalance` оновлено.
2. **Часткова алокація** ($60 на charge $100) → charge `partial`, `outstanding:"40.00"`.
3. ⛔ **Over-allocation** (Σ > сума платежу) → `409`.
4. ⛔ **Та сама пара (payment, charge)** двічі → `409`.
5. **moneyBalance** = Σ(no-order платежі) − Σ(charge) (+ bonus-застосовано) — звір `GET /portal/wallet` (`moneyBalance`).

---

## 6. Оплата бонусами + виписка (S5-08)

1. **Оплатити інвойс бонусами (власник компанії).** Маючи charge на $100 і бонус $30:
   `POST $API/portal/invoices/:chargeId/pay-with-bonus` (тіло `{}` або `{"amount":30}`)
   ✅ `201`, `spent:"30.00"`, charge `partial` (outstanding $70), `bonusBalance:"0.00"`.
2. ⛔ **view-only member** (не власник компанії) → `403` (виправлено в аудиті — раніше пропускало).
3. ⛔ **Charge вже погашений** → `409`. **Не-USD charge** → `400`.
4. **Виписка.** `GET /portal/wallet/statement?from=2026-06-01&to=2026-06-30`
   ✅ `{bonus, money:{balance,status}, timeline:[...]}` — charge+payment+bonus у хронології.
5. **Перевір, що revenue НЕ роздулось:** `GET /workspace/billing/overview` — `totalRevenueUsd` **не включає** $30 бонусу (bonus має `amountUsd=0`).

---

## 7. Лояльність (S5-09)

1. **Публічна таблиця тірів.** `GET $API/loyalty/tiers` (без авторизації) ✅ 4 тіри з порогами+знижками.
2. **Тір компанії.** `GET /workspace/companies/:id/loyalty` ✅ earned/effective tier, lifetime, прогрес, історія.
3. **Override (owner).** `POST /workspace/companies/:id/loyalty/override-discount {"tier":"vip"}` ✅ `effectiveTier:"vip"`, `discountPercent:12`. `{"tier":null}` — зняти. ⛔ executor → `403`.
4. **Recalc-крон** (02:30 UTC) — після платежів на ≥$1000 lifetime компанія підіймається до `regular` (можна почекати ніч або тригернути перевіркою БД). Ніколи не **знижує** тір.

---

## 8. Команда + виплати (S5-04)

1. **Ставка виконавця (owner).** `POST /workspace/executors/:id/rates {"monthlySalary":2000,"commissionPercent":10}` ✅ `201`. Повторний POST — **append** (стара ставка отримує `effectiveUntil`).
2. ⛔ **Executor ставить ставку** → `403`. **Executor читає чужі ставки** → `403` (свої — `200`).
3. **Згенерувати виплату.** `POST /workspace/team/payouts/generate {"period":"2026-06"}`
   ✅ `200`, payout `total = salary + commission%×виручка_по_замовленнях_виконавця`.
4. **Workflow.** `POST /workspace/team/payouts/:id/approve` (draft→approved) → `/mark-paid` (approved→paid).
   ⛔ approve вже approved → `409`; mark-paid на draft → `409`.
5. ⛔ **Лок time-log.** Після `approve` за період — `PATCH`/`DELETE`/**POST** time-log у тому періоді → `409` (виправлено в аудиті — POST теж блокується).
6. **Команда.** `GET /workspace/team` ✅ список; ЗП (`rate`) бачить **лише owner** (executor бачить null).

---

## 9. Фінанси + P&L (S5-10) — owner-only

1. **Створити витрату.** `POST /workspace/expenses {"type":"recurring","category":"software","amount":99,"frequency":"monthly","startDate":"2026-06-01"}` ✅ `201`.
2. **P&L.** `GET /workspace/reports/pnl?from=2026-06-01&to=2026-06-30`
   ✅ `{revenueUsd, expensesUsd, salaryUsd, netProfitUsd, marginPct, byCategory}`. Перевір: `netProfit = revenue − expenses`; salary йде **з ExecutorRate** (не з manual category=salary).
3. **CSV.** `GET /workspace/reports/pnl.csv?from=...&to=...` ✅ `text/csv`, рядки category+summary.
4. **Витрата у UAH** → нормалізується в USD за курсом.
5. ⛔ **Hard-delete активної витрати** → `409` (спершу archive). **Executor** на будь-якому з цих → `403`.

---

## 10. Наскрізна безпека (швидка перевірка)

- ⛔ **Cross-tenant:** будь-який `:companyId`/`:id`/`:chargeId` з іншої агенції → `403`/`404` (жоден не повертає чужі дані).
- ⛔ **RBAC:** client не лізе у workspace; executor не робить owner-only (rates/payouts/expenses/wallet-adjust/referral-settings/loyalty-override/payment-settings).
- ⛔ **Idempotency reuse** → `422`; **overdraw/over-allocation/already-paid** → `409`.
- **Гаманець-інваріант:** після серії credit/debit `bonusBalance == Σcredit − Σdebit` і ніколи не відʼємний.

---

## Що НЕ тестуємо вручну зараз (свідомо)

- **Нотифікації** (email/telegram про платіж/бонус/тір) — відкладені на **S6** (ledger durable, бракує лише доставки).
- **Білінговий UI** — окремий фронт-спринт; зараз усе через API.
- **RLS-ізоляція в БД** — покрита автотестом (`tenantIsolation.test.ts`); вмикається перед першим зовнішнім тенантом.

## Автоматизоване покриття (для довідки)

**343 unit + 57 gated integration** (на реальному PG16) + **46 types**. Integration-набір (`apps/api/tests/integration/*`, гейт `RUN_DB_TESTS=1`) доводить саме те, що мок не може: idempotency через `ON CONFLICT`, concurrency через `FOR UPDATE`, інваріанти гаманця/алокації, FX-immutability, referral-ідемпотентність, loyalty boundary, payout-lock, P&L. Запуск локально: підняти PG16, `prisma migrate deploy`, `DATABASE_URL=... RUN_DB_TESTS=1 pnpm --filter @workflo/api test`.
