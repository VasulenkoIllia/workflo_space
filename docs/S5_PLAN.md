# Sprint 5 (Financial Core) — Implementation Plan

> Джерело: understand-workflow `s5-understand` (8 агентів, 2026-06-08). Канон послідовності/контрактів S5.
> Пов'язано: [`TRACKER.md`](TRACKER.md) (SPRINT 5) · модулі 05-billing/22-finance/25-wallet/10-loyalty/12-team.
> Принципи: **backend-first · test-first · idempotency-first**. Гроші = `Prisma.Decimal`, ніколи JS `Number`-арифметика на балансах.

## 3 критичні знахідки (формують план)

1. **`tenantTransaction` НЕ має isolation-level passthrough** — `{isolationLevel:'Serializable'}` не спрацює; race-guard через `SELECT … FOR UPDATE` row-locks усередині RLS-tx.
2. **Немає `IdempotencyKey` таблиці/middleware** — будувати з нуля (header-based, 24h TTL).
3. **`Payment` має `@@unique([provider,providerPaymentId])`, але БЕЗ `amountUsd/rateUsed/sourceType/sourceId`** — це дельти аудит-спеки, ще не змігровані.

---

1. **`tenantTransaction` has NO isolation-level passthrough** — the billing-spec's `{ isolationLevel: 'Serializable' }` example will NOT work as-is. The race guard must either extend `tenantTransaction` to accept options, or use `SELECT ... FOR UPDATE` row locks inside the existing interactive tx (the spec's other recommended approach, and the simpler one given RLS GUC coupling).
2. **No `IdempotencyKey` table or middleware exists** — header-based idempotency must be built from scratch.
3. **Payment has `provider`+`providerPaymentId` unique but NO `sourceType`/`sourceId`/`amountUsd`/`amountNative`/`rateUsed`** — those are audit-spec deltas not yet migrated. The idempotency anchor for manual payments needs a new column.

Here is the plan.

---

# Sprint 5 (Financial Core) — Executable Implementation Plan

## 0. Confirmed Baseline (DO NOT REBUILD)

From the audit scaffold, these already exist and are correct:

- **Schema models**: `Payment` (with `@@unique([provider, providerPaymentId])`), `PaymentSettings`, `ExecutorRate` (with `@@unique([executorId, effectiveFrom])` historical windows), `ExchangeRate` (per-agency `@unique`, `usdToUah`/`eurToUah`), `Referral`/`ReferralBonus` (with `@@unique([sourceType, sourceId])`), `CompanyService`, `ServiceCharge` (with `@@unique([companyServiceId, month])`), `UsageCounter`, `AgencyFeatureFlag`.
- **Constants** (`@workflo/types/src/constants.ts`): `LOYALTY_TIER_THRESHOLDS_USD`, `LOYALTY_DISCOUNT_PCT`, `calculateLoyaltyTier()`, `DEFAULT_DEPARTMENT_SLUGS`, `REFERRAL_CODE_*`. **These are the loyalty source of truth — use, do not redefine.**
- **Patterns**: `withTenant`/`tenantTransaction` (RLS GUC), `requireActiveAgency`/`assertSameTenant`/`tenantWhere`/`tenantData`, `can(user, action, {agencyId, companyId})`, `writeAuditAsync`, `enqueueOutbox`/outboxWorker, `dispatchNotification`, `assertWithinQuota`/`assertAgencyActive` (Phase-0 no-ops at call sites).
- **Permissions already in `can.ts`**: `payment.confirm`, `invoice.create/send/cancel`, `finance.read`, `finance.write`, `billing.view`, `executor.invite/deactivate`, `admin.access`, `company.*`.
- **Zod**: `confirmPaymentSchema` (with `hasTwoFractionDigits` money refinement) already in `billing.schema.ts` — extend this file.

**Models that are ABSENT and must be created** (S5 net-new): `WalletTransaction`, `PaymentAllocation`, `ReferralSettings`, `LoyaltyTierHistory`, `ExecutorPayout`, `Expense`, `Service` catalog enrichment (`isRecurring`), `IdempotencyKey`, `Department` (if not present). Plus column deltas on `Payment` (`amountUsd`, `rateUsed`, `idempotencyKey`-anchor or `sourceType`/`sourceId`), `ServiceCharge` (`baseAmount`, `discountPct`, `discountAmount`, `totalAmount`), `CompanyService` (`frequency`, `nextChargeAt`), `Company` (`moneyBalance`, `tierOverride`).

---

## 1. Dependency-Ordered Sequence

The hard data dependencies:

- **Payments are the root of the money graph.** Loyalty `lifetimePaidUsd`, P&L revenue, wallet money-account, and referral accrual ALL read confirmed `Payment` rows. → Payments first.
- **`amountUsd` snapshot requires an FX rate at payment time.** → ExchangeRate cron/read must exist before payments can snapshot USD reliably (but payments can default `rateUsed=1` for USD-native in increment 1; FX wiring follows).
- **Wallet allocation references Payment + ServiceCharge.** → S5-05/07 after S5-02/03.
- **Referral accrual credits the wallet ledger.** → S5-06 after S5-05.
- **Earnings/P&L read ExecutorRate (already scaffolded) but salary must not double-count payouts.** → S5-04 before/with S5-10.
- **Loyalty discount writes into ServiceCharge at charge-creation time.** → S5-09 discount-apply depends on S5-03 charge generation; tier-recalc cron depends on confirmed Payments (S5-02).

### Ordered waves

**WAVE A — Foundations (strictly first, mostly sequential)**

1. **S5-01** `@workflo/payments` provider + ManualProvider + race-guard primitive. _(no DB dep; pure package; unblocks S5-02)_
2. **Schema migration `s5_00_financial_core`** — all net-new models + column deltas in ONE reviewed migration (so downstream tasks don't each fight Prisma). _(blocks everything DB-touching)_
3. **S5-03a** ExchangeRate read service + НБУ cron (`amountUsd` snapshots need this). _(parallel-safe with S5-01 once migration lands)_

**WAVE B — Payments core (sequential after A)** 4. **S5-02** Billing summary + charges read + `POST payments` (idempotent) + advance settlement. _(consumes S5-01 + ExchangeRate; root of money graph)_ 5. **S5-03b** Services CRUD + assign + recurring-charges cron (pg_cron + Node companion). _(needs CompanyService deltas; independent of S5-02 write path → can parallelize with #4 after migration)_

**WAVE C — Ledgers (after payments exist)** 6. **S5-05** `WalletTransaction` ledger + `walletCredit`/`walletDebit` (FOR UPDATE, invariant). _(pure bonus ledger; depends only on migration + Company.bonusBalance)_ 7. **S5-07** Money-account: `PaymentAllocation` + `moneyBalance` + charge states. _(depends on S5-02 payments + S5-03 charges)_ 8. **S5-06** Referral accrual → walletCredit + `ReferralSettings`. _(depends on S5-05 walletCredit + Payment confirmation hook from S5-02)_

**WAVE D — Read models + finance (after ledgers)** 9. **S5-08** Unified statement (bonus + money timeline) + bonus-spend on invoice. _(depends on S5-05 + S5-07)_ 10. **S5-09** Loyalty tier-recalc cron + discount-apply + `LoyaltyTierHistory`. _(recalc depends on S5-02 payments; discount-apply hooks into S5-03 charge creation)_ 11. **S5-04** Team rates/earnings + `ExecutorPayout` + members/permissions. _(ExecutorRate scaffolded; earnings read TimeLog + ExecutorRate; mostly independent → can run in parallel with WAVE C)_ 12. **S5-10** Finance `Expense` CRUD + P&L (revenue − expenses, salary from ExecutorRate). _(depends on S5-02 revenue + S5-04 ExecutorRate salary semantics for no-double-count)_

### Parallelization map

- After migration `s5_00` lands: **S5-03b (services/recurring)**, **S5-04 (team)**, and **S5-05 (wallet bonus ledger)** have no mutual dependency and can be built concurrently by separate streams.
- **S5-06, S5-07, S5-08, S5-09(discount), S5-10** are the convergence tail — they need the payment/charge/ledger writers in place.
- Crons (ExchangeRate, recurring-charges, loyalty-recalc, invite-expiry) share `apps/api/src/cron/index.ts` — create that file ONCE in S5-03a and append.

---

## 2. Per-Task Detail

### S5-01 — `@workflo/payments` provider + ManualProvider + race-guard

**Schema delta:** none (package only).
**Build:**

- Extend `PaymentProvider` interface beyond the current `confirmPayment`: add the audit-chosen surface as **optional** methods so ManualProvider stays minimal and future Mono/Stripe/WayForPay adapters slot in: `createPaymentLink?`, `handleWebhook?`, `verifySignature?`, `refund?`. Keep `confirmPayment` required.
- `ConfirmPaymentInput` must carry an **idempotency anchor**: add `idempotencyKey: string`, `externalRef?: string`. Return `{ ok: boolean; providerPaymentId: string | null }` (ManualProvider returns `null` → relies on the API-layer idempotency table, since manual rows intentionally allow NULL `providerPaymentId`).
- **Race-guard primitive** lives here as a pure, DB-agnostic helper contract — the package exports an interface `RaceGuard` with `runExclusive(key, fn)` semantics; the concrete DB-backed implementation (FOR UPDATE / idempotency-table) lives in `apps/api` (the package must NOT import Prisma). The package only defines the _contract_ + a deterministic in-memory test double.
  **Invariants:** provider methods are pure/side-effect-described; ManualProvider is deterministic; no money mutation in the package.
  **TEST LIST (`packages/payments/__tests__`):**
- `ManualProvider.confirmPayment` returns `{ ok: true, providerPaymentId: null }` for valid input.
- Interface conformance: a stub `StripeProvider` implementing all optional methods type-checks.
- `RaceGuard` test double: two concurrent `runExclusive(sameKey, fn)` → `fn` runs exactly once; second resolves with the first's result (not a re-run).
- `runExclusive` with distinct keys runs both.
- Input validation: rejects negative/NaN amount (delegates to caller's Zod, but provider guards `amount > 0`).

### S5-00 migration — `s5_00_financial_core` (single reviewed migration)

**New models:**

- `WalletTransaction { id, agencyId, companyId, type(WalletTxnType), source(WalletTxnSource), amount Decimal(12,2), balanceAfter Decimal(12,2), currency, sourceId?, note?, createdById?, createdAt; @@index([companyId, createdAt]); @@index([agencyId]) }` + RLS.
- `PaymentAllocation { id, agencyId, paymentId, chargeId, amount Decimal(12,2), createdAt; @@unique([paymentId, chargeId]); @@index([chargeId]) }` + RLS. _(unique pair prevents double-allocating same payment→charge)_
- `ReferralSettings { id, agencyId @unique, enabled, tiers Json, updatedAt, updatedBy? }` — **per-agency, drop singleton** (matches wallet-spec multi-tenant note).
- `LoyaltyTierHistory { id, agencyId, companyId, fromTier?, toTier, reason?, at; @@index([companyId, at]) }`.
- `ExecutorPayout { id, agencyId, executorId, period String(YYYY-MM), baseSalary Decimal(10,2), billableHours Decimal(8,2), hourlyEarned Decimal(10,2), commissionAmount Decimal(10,2), total Decimal(10,2), currency, status(PayoutStatus draft|approved|paid), approvedBy?, paidAt?, createdAt; @@unique([executorId, period]) }`. _(unique = idempotent payout generation per period)_
- `Expense { id, agencyId, type(ExpenseType recurring|one_time), category(ExpenseCategory), source(ExpenseSource manual|executor_rate), vendor?, amount Decimal(10,2), currency, frequency(ExpenseFrequency monthly|quarterly|annual|one_time)?, startDate, endDate?, executorId?, companyId?, isActive, createdById, createdAt, updatedAt; @@index([agencyId, category]) }`.
- `IdempotencyKey { key String, endpoint String, agencyId, requestHash String, responseStatus Int?, responseBody Json?, createdAt, expiresAt; @@id([key, endpoint]); @@index([expiresAt]) }` + RLS. _(24h TTL, swept by cron)_
- `Department { id, agencyId, slug, name, isActive; @@unique([agencyId, slug]) }` (seed `DEFAULT_DEPARTMENT_SLUGS` via `provisionAgency`) — only if absent.
  **Column deltas:**
- `Payment += amountUsd Decimal(10,2)?, rateUsed Decimal(10,4)?, sourceType String?, sourceId String?, paymentMethod/paymentReference already present`. Add `@@unique([agencyId, sourceType, sourceId])` for non-manual idempotency (NULLs distinct → manual still allowed; manual dedup handled by `IdempotencyKey`).
- `ServiceCharge += baseAmount Decimal(10,2)?, discountPct Decimal(5,2)?, discountAmount Decimal(10,2)?, totalAmount Decimal(10,2)?, currency String @default("USD")`; extend `ChargeStatus` enum with `written_off`.
- `CompanyService += frequency(ChargeFrequency monthly|quarterly|annual) @default(monthly), nextChargeAt DateTime?`.
- `Company += moneyBalance Decimal(12,2) @default(0), tierOverride LoyaltyTier?`.
- `Service += isRecurring Boolean @default(true)` (if absent), `defaultPriceUsd` confirm present.
  **Enums:** `WalletTxnType{credit,debit}`, `WalletTxnSource{referral_bonus,manual_adjustment,invoice_payment,refund}`, `PayoutStatus{draft,approved,paid}`, `ExpenseType`, `ExpenseCategory{infrastructure,software,salary,contractor,rent,tax,marketing,other}`, `ExpenseSource{manual,executor_rate}`, `ExpenseFrequency`, `ChargeFrequency`.
  **RLS:** every new tenant table gets `ENABLE ROW LEVEL SECURITY` + `FORCE` + policy `wf_in_tenant("agencyId")` (copy the Block-1 pattern from `20260607_block1_schema_hardening` and `20260603_f4_rls_policies`).

### S5-02 — Billing summary + charges + POST payments + advance + idempotency

**Endpoints + Zod (extend `billing.schema.ts`):**

- `GET /portal/billing/summary` → `{ debt, debtUah, services[], totalPaid, loyaltyTier, discountPercent, bonusBalance, paymentSettings }`.
- `GET /portal/billing/charges?month=YYYY-MM`, `GET /portal/billing/payments`, `GET /portal/billing/payment-settings` (read-only).
- `GET /workspace/billing/overview` → total debt, monthly sum, top debtors.
- `POST /workspace/billing/payments` — **idempotent via `Idempotency-Key` header**. Body schema (new `createPaymentSchema`): `{ companyId: uuid, orderId?: uuid, chargeId?: uuid, amount: money (reuse hasTwoFractionDigits), currency, type: PaymentType, paymentMethod?, paymentReference?, note? }`. Response 201 `{ id, companyId, amount, type, confirmedAt, newDebt, orderPaidAt? }`.
- `GET /workspace/billing/charges?month=&companyId=`, `POST /workspace/billing/charges/generate { month }` (manual cron fallback).
- `GET/PATCH /workspace/settings/payment`.
  **Idempotency middleware:** a `preHandler` (or service `withIdempotency(key, endpoint, agencyId, requestHash, fn)`) that: (1) hashes the request body; (2) `INSERT IdempotencyKey ... ON CONFLICT DO NOTHING` inside the tenant tx; (3) on conflict with matching hash → replay stored response; on conflict with **different** hash → 422 `idempotency_key_reuse`; (4) stores `{status, body}` on success. TTL 24h.
  **Core invariants (the money-correctness heart):**
- `POST payments` runs in `tenantTransaction`; lock the target row(s) with **`SELECT ... FOR UPDATE`** — lock `Order` (if `orderId`) and/or `ServiceCharge` (if `chargeId`) by raw `tx.$queryRaw`. **Do NOT rely on `isolationLevel: 'Serializable'`** — `tenantTransaction` does not pass it through; row locks inside the RLS interactive tx are the correct mechanism (and the spec's alternative).
- `balance_due = order.totalAmount − SUM(payments WHERE orderId AND status=confirmed AND type IN (advance,final,partial))`; if `≤ 0` → set `order.paidAt = now()`, mark paid; guard re-pay of already-`paid` charge → 409 `charge_already_paid`.
- `amountUsd` snapshot: if `currency='USD'` → `amountUsd = amount, rateUsed = 1`; else read ExchangeRate for agency, `amountUsd = amount / rate`, store `rateUsed`. **Snapshot at confirm-time, never recompute** (FX immutability).
- Decimal: all money via Prisma `Decimal`; never `Number()` arithmetic on balances — use `Prisma.Decimal` or DB-side aggregation.
- After commit (or via outbox in-tx): enqueue `billing.invoice_paid`/`payment_confirmed` notification; `writeAuditAsync('payment.created')`; emit a domain hook that S5-06 (referral accrual) and S5-09 (tier-recalc trigger) subscribe to.
  **TEST LIST:**
- Happy path: confirm payment → Payment row, `newDebt` correct, audit logged.
- **Idempotency: same `Idempotency-Key` + same body twice → ONE Payment row, second returns identical 201 (replayed).**
- Idempotency: same key, different body → 422.
- **Concurrency: two parallel confirms (same charge, distinct keys) → exactly one succeeds in marking `paid`, other gets 409 (FOR UPDATE serializes).**
- **Double-click simulation: two parallel confirms with SAME key → one Payment, no double debt.**
- Advance settlement: advance + final summing to `totalAmount` → `order.paidAt` set; over-advance (advance > total) allowed but `newDebt = 0` and flagged.
- USD-native: `rateUsed=1, amountUsd=amount`. Non-USD (UAH): `amountUsd = amount/rate`, `rateUsed` snapshotted; later rate change does NOT alter stored `amountUsd`.
- Tenant isolation: confirming payment for a company in another agency → 403 (`assertSameTenant`), RLS blocks cross-tenant read.
- RBAC: caller without `payment.confirm` → 403.
- Money edge: amount with >2 decimals → 400 (Zod refine); amount = 0 / negative → 400.

### S5-03 — ExchangeRate НБУ cron + Services CRUD + recurring charges cron

**Schema delta:** `Service.isRecurring`, `CompanyService.frequency`/`nextChargeAt` (in s5_00).
**S5-03a ExchangeRate:**

- `apps/api/src/cron/index.ts` (`initCronJobs`, skip in test env) + `cron/exchangeRate.ts` — `cron.schedule('10 6 * * *', …, {timezone:'UTC'})` (06:10 UTC = 09:10 Kyiv). Fetch `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json`; **per-agency `upsert` on `{agencyId}`** (loop agencies); fallback to last rate on HTTP failure (no throw); warn if `updatedAt` > 3 days. Add `featureEnabled`/no-op guard.
- `GET/PATCH /workspace/settings/exchange-rate`, `POST /workspace/settings/exchange-rate/refresh` (force sync, owner only).
  **S5-03b Services CRUD + recurring:**
- `GET/POST /workspace/services`, `PATCH/DELETE /workspace/services/:id` (delete/price-change only if no active `CompanyService` → 409 otherwise), `POST /workspace/services/:id/assign {companyId, customPrice}` → creates `CompanyService` with `nextChargeAt = first of next month`, `PATCH/DELETE /workspace/services/:id/companies/:companyId`.
- Recurring charge generation: **pg_cron** SQL `'1 0 1 * *'` `INSERT … ON CONFLICT (company_service_id, month) DO NOTHING` (idempotent, the unique constraint is the guard). Node companion `cron/recurringCharges.ts` `'5 0 1 * *'` enqueues `billing.invoice_sent` for freshly-created pending charges. The manual fallback `POST /workspace/billing/charges/generate` shares the same insert logic (service function reused by cron + endpoint).
  **Invariants:** `@@unique([companyServiceId, month])` makes generation idempotent under retries/double-runs; charge amount = `customPrice` (loyalty discount applied by S5-09 hook at insert time).
  **TEST LIST:**
- ExchangeRate cron: successful fetch upserts per-agency; HTTP 500 → keeps last rate, logs warn, no throw; stale >3d → warn path hit. (mock `fetch`, freeze time.)
- Service create/update/delete; delete blocked when active assignment exists → 409.
- Assign sets `nextChargeAt` = 1st of next month.
- **Recurring generation idempotency: running generate twice for same month → no duplicate charges (ON CONFLICT).**
- Manual generate endpoint produces identical rows to cron.
- Tenant scope: services/charges only within agency.

### S5-04 — Team rates/earnings + ExecutorPayout + members/permissions

**Schema delta:** `ExecutorPayout`, `Department` (s5_00). ExecutorRate already has `monthlySalary`, `commissionPercent`, `effectiveFrom/Until` — **do not rebuild**; optionally add `hourlyRate`, `departmentId` if specs demand (flagged optional).
**Endpoints:** `GET /workspace/executors/:id/rates`, `POST /workspace/executors/:id/rates` (new row, never in-place update — append with new `effectiveFrom`), `GET /workspace/team`, invite/list/revoke/deactivate (reuse existing invite infra), `GET /workspace/team/payouts?period=`, `POST …/:id/approve`, `POST …/:id/mark-paid`, `GET /workspace/team/workload`, permissions read.
**Earnings/payout calc:** for `period=YYYY-MM`, pick ExecutorRate active on period (window `effectiveFrom ≤ period ≤ effectiveUntil`); `base = monthlySalary`; `hourlyEarned = SUM(billable TimeLog.hours in period) × hourlyRate`; `commission = commissionPercent × billable revenue`; `total = base + hourlyEarned + commission`. Generation is **idempotent via `@@unique([executorId, period])`**; status `draft → approved → paid`; approving locks the underlying time logs.
**Invariants:** payout per (executor, period) unique; status transitions monotonic; rate history append-only (no update of past rows — enforce via the `effectiveFrom` unique).
**TEST LIST:**

- New rate creates a new row; old row gets `effectiveUntil` set; querying rate-on-date returns the window-correct row.
- Payout calc: salary + billable hours × rate + commission; numbers match fixtures.
- Payout generation idempotent (re-run same period → no dup).
- Status workflow: draft→approved→paid valid; paid→draft rejected; approve sets `approvedBy`.
- Approving payout locks time logs (subsequent edit → 409).
- Tenant + RBAC (`team.manage`/`finance.write`).

### S5-05 — Wallet bonus ledger + walletCredit/Debit (FOR UPDATE, invariant)

**Schema delta:** `WalletTransaction` (s5_00). `Company.bonusBalance` exists.
**Services (`apps/api/src/services/wallet.ts`):**

- `walletCredit(tx, {companyId, agencyId, source, amount, sourceId, note?, createdById?})` and `walletDebit(...)`. Both take the **already-open `tx`** (so callers compose them inside their own tenant tx — referral accrual, payment-confirm, invoice-spend all wrap). Each: (1) `SELECT … FROM companies WHERE id=$1 FOR UPDATE` (raw, under RLS GUC); (2) compute `newBalance`; (3) `debit` guards `amount ≤ bonusBalance` → else throw `AppError(409, 'insufficient_bonus')`; (4) INSERT WalletTransaction with `balanceAfter=newBalance`; (5) UPDATE `company.bonusBalance`; (6) return txn. Emit `wallet.credited`/`wallet.debited` via outbox enqueued in same tx.
  **Endpoints:** `GET /portal/wallet`, `GET /portal/wallet/transactions?page=&type=`; `GET /admin/wallet/companies?search=`, `GET …/:companyId/transactions`, `POST …/:companyId/adjust {type, amount, note(required)}`.
  **Invariants (non-negotiable):**
- **`Company.bonusBalance == Σ(credit.amount) − Σ(debit.amount)`** after every op.
- **`bonusBalance ≥ 0` always** (debit guard).
- `amount > 0` always; direction is `type`.
- `balanceAfter` computed under the row lock (prevents lost updates).
- `manual_adjustment` requires non-empty `note`.
- All atomic in a single `tenantTransaction`.
  **TEST LIST:**
- Credit then debit → balance + ledger consistent; `balanceAfter` matches running sum.
- **Concurrency: N parallel credits of $10 each → final balance exactly N×$10, ledger has N rows (FOR UPDATE prevents lost update).**
- **Debit guard: parallel debits that would overdraw → exactly the affordable ones succeed, rest 409; balance never negative.**
- Invariant assertion test: after a randomized sequence of credits/debits, `bonusBalance == Σcredit − Σdebit`.
- Manual adjust without note → 400.
- Tenant isolation on `/admin/wallet/*` (cross-agency companyId → 403/RLS).

### S5-06 — Referral accrual → credit + ReferralSettings

**Schema delta:** `ReferralSettings` (s5_00). `Referral`/`ReferralBonus` exist with `@@unique([sourceType,sourceId])`.
**Flow:** `processReferralBonus(tx, {payment})` — invoked from the S5-02 payment-confirm hook **inside the same tx**: (1) find depth-1 referrer of the paying company; (2) `getReferralPercent(agencyId, referrerLifetime)` reads `ReferralSettings.tiers` (5-min cache, NOT hardcoded); (3) `INSERT ReferralBonus … ON CONFLICT (sourceType, sourceId) DO NOTHING` (idempotency: one bonus per payment); (4) if inserted, `walletCredit(tx, {source:'referral_bonus', sourceId: referralBonus.id, …})`; (5) bump `Referral.totalEarned`.
**Endpoints:** `GET/PATCH /admin/referral/settings` (admin; `tiers` Json; audit `referral.tiers_updated` old→new).
**Invariants:** a payment accrues a referral bonus **at most once** (DB unique); historical `ReferralBonus.percent` immutable when tiers change later; accrual atomic with the triggering payment (or via outbox replay-safe).
**TEST LIST:**

- Payment by referred company → referrer credited correct %; WalletTransaction `source=referral_bonus` created.
- **Idempotency: replaying the same payment (or double-processing the hook) → exactly ONE ReferralBonus + ONE credit (ON CONFLICT).**
- No referrer → no accrual, no error.
- Tier change does not retroactively alter already-accrued bonus percent.
- `ReferralSettings.enabled=false` → no accrual.
- Tenant scope.

### S5-07 — Money-account: PaymentAllocation + moneyBalance + states

**Schema delta:** `PaymentAllocation`, `Company.moneyBalance` (s5_00).
**Logic:** on payment confirm (S5-02), optionally allocate to charges (FIFO by `dueDate` or explicit `chargeId`); `INSERT PaymentAllocation`; recompute `Company.moneyBalance = Σ(confirmed payments) − Σ(charges)` (derived cache, recomputable). Charge state derived from `Σ allocation per charge` vs `charge.totalAmount`: `awaiting | partial | paid | overdue | overpaid`.
**Invariants:**

- **`Σ allocation.amount per payment ≤ payment.amount`** (enforced under lock at allocation INSERT → else 409 `over_allocation`).
- `@@unique([paymentId, chargeId])` prevents double-allocating the same pair.
- `moneyBalance` is a single-writer derived cache; recompute under the payment lock.
- Remainder of a payment = prepaid credit (advances).
  **TEST LIST:**
- Full allocation → charge `paid`, `moneyBalance` updated.
- Partial allocation → charge `partial`.
- **Over-allocation (Σ > payment.amount) → 409.**
- Overpayment → `moneyBalance > 0`, charge `overpaid`.
- Concurrency: parallel allocations of one payment → cumulative never exceeds payment amount (FOR UPDATE on payment).
- State derivation matrix (awaiting/partial/paid/overdue/overpaid) per fixtures.
- `moneyBalance` recompute equals `Σpayments − Σcharges` after randomized ops.

### S5-08 — Unified statement + bonus-spend on invoice

**Endpoints:** `GET /portal/wallet/statement?from=&to=`, `GET /admin/wallet/companies/:id/statement` (admin adds sourceId tracing). Response = `{ bonus:{balance}, money:{balance,status}, timeline:[charge|payment|bonus events sorted by date] }`.
**Bonus-spend:** `POST /portal/invoices/:id/pay-with-bonus` (or workspace) → `walletDebit(tx, source:'invoice_payment', sourceId:chargeId)` + create `PaymentAllocation`/reduce charge outstanding, all in one tx. **Discount precedence recorded: discount → tax → bonus-debit** (per loyalty audit note).
**Invariants:** statement is read-only aggregation of two ledgers; bonus-spend cannot overdraw (reuses S5-05 debit guard); spend is allocation-consistent (S5-07 invariant).
**TEST LIST:**

- Statement merges bonus + money + charges in date order; balances match.
- Date-range filter correct.
- Bonus-spend reduces charge outstanding and bonusBalance atomically; overdraw → 409.
- Refund path: `walletCredit(source:'refund')` linked to original debit.
- Tenant scope.

### S5-09 — Loyalty tier-recalc cron + discount-apply + LoyaltyTierHistory

**Schema delta:** `LoyaltyTierHistory`, `Company.tierOverride` (s5_00). **Use `@workflo/types` constants — do not redefine thresholds.**
**Cron `cron/loyaltyRecalc.ts`** `'30 2 * * *'` UTC: per company, `lifetimePaidUsd = Σ Payment.amountUsd WHERE status=confirmed` (refunds excluded); `newTier = calculateLoyaltyTier(lifetimePaidUsd)`; respect `tierOverride`; **upgrade-only** (rank check, never auto-downgrade); on change → update `loyaltyTier`, update `totalSpent` cache (**cron is the ONLY writer of `totalSpent`**), INSERT `LoyaltyTierHistory`, fire `loyalty.tier_upgraded` (email+telegram+in_app).
**Discount-apply:** hook in S5-03 charge creation → `baseAmount`, `discountPct = LOYALTY_DISCOUNT_PCT[tier]` (or `tierOverride`), `discountAmount`, `totalAmount`. Owner per-invoice override audit-logged.
**Endpoints:** `GET /workspace/companies/:id/loyalty` (tier+progress+history), `GET /loyalty/tiers` (public), `POST /workspace/companies/:id/loyalty/override-discount` (admin, audit-logged).
**Invariants:** single writer for `totalSpent` (cron); upgrade-only; refunds excluded from lifetime; history append-only; thresholds from constants.
**TEST LIST:**

- Recalc upgrades at threshold boundaries (999.99→NEW, 1000→REGULAR, etc. using constants).
- **Never downgrades** even if lifetime drops (refund).
- `tierOverride` respected (cron won't clobber).
- Discount-apply: charge gets correct `discountPct/Amount/totalAmount` for tier.
- `LoyaltyTierHistory` row on upgrade; `loyalty.tier_upgraded` notification fired.
- `totalSpent` only mutated by cron (payment path does not touch it).
- Refunds excluded from `lifetimePaidUsd`.

### S5-10 — Finance Expense CRUD + P&L

**Schema delta:** `Expense` (s5_00).
**Endpoints:** `GET/POST/PUT /workspace/expenses`, `POST /workspace/expenses/:id/archive` (soft, `isActive=false`), `DELETE /workspace/expenses/:id` (hard, only if not in finalized report), `GET /workspace/reports/pnl?from=&to=`, `GET /workspace/reports/pnl.csv`.
**P&L calc:** `revenueUsd = Σ Payment.amountUsd (confirmed, in period)`; `expenses` = normalized recurring (monthly=100%, quarterly÷3, annual÷12, one_time=full in startDate month) **PLUS salary auto-pulled from `ExecutorRate.monthlySalary` for active windows** with `source='executor_rate'`. **Double-count guard: owner-entered salary expenses are `source='manual'`; executor-rate salary is `source='executor_rate'`; never both for the same executor/period.** P&L does NOT also count ExecutorPayout (payouts are settlement, ExecutorRate is the P&L cost basis — pick ExecutorRate as the single salary source). `netProfit = revenue − expenses`, `marginPct`.
**Invariants:** salary counted once (ExecutorRate, not payout, not manual dup); FX-normalized to USD via snapshot; hard-delete blocked if finalized.
**TEST LIST:**

- Frequency normalization (monthly/quarterly/annual/one_time) → correct monthly amount.
- **Salary appears once from ExecutorRate (not double-counted with manual or payout).**
- Revenue = Σ confirmed amountUsd in period.
- P&L numbers + margin match fixtures; multi-currency expense normalized to USD.
- Archive soft-deletes; hard-delete of finalized → 409.
- CSV export shape.
- Tenant + `finance.read`/`finance.write`.

---

## 3. Cross-Cutting Risks

- **Tenant/RLS:** Every new model needs `agencyId` + RLS `ENABLE/FORCE` + `wf_in_tenant("agencyId")` policy (copy Block-1/F4 migration pattern). `WalletTransaction`, `PaymentAllocation`, `IdempotencyKey`, `ReferralSettings` per-agency. All `/admin/*` endpoints need explicit `assertSameTenant` on loaded resources (IDOR) — RLS is defense-in-depth, not a substitute. `ReferralSettings` must be `@@unique([agencyId])`, NOT the `id='singleton'` pattern in the wallet-spec draft (superseded).
- **Decimal precision:** ALL money is Prisma `Decimal` (10,2 amounts / 12,2 balances / 10,4 rates). **Never do JS `Number` arithmetic on balances** — use `Prisma.Decimal` ops or DB-side `_sum`/raw SQL. Zod `hasTwoFractionDigits` refine on all amount inputs (already exists — reuse). `balanceAfter` snapshot computed in SQL/Decimal under lock.
- **Currency (USD base + FX snapshot):** `amountUsd`/`rateUsed` snapshotted at confirm-time from per-agency `ExchangeRate`; **immutable thereafter** (later rate changes never recompute historical USD). USD-native → `rateUsed=1`. Loyalty lifetime and P&L revenue both read `amountUsd` (the snapshot) — consistent basis. Stale-rate (>3d) warning surfaced.
- **Concurrency:** The big one. `tenantTransaction` does NOT support `isolationLevel` passthrough — use **`SELECT … FOR UPDATE` row locks** inside the RLS interactive tx (on Company for wallet, Order/ServiceCharge for payments, Payment for allocation). Idempotency-Key table + unique constraints (`payments`, `referral_bonuses`, `service_charges`, `payment_allocations`, `executor_payouts`) are the second line. If true Serializable is needed later, extend `tenantTransaction` to accept options as a separate hardening task (flag, don't inline).
- **Double-counting:** Salary in P&L (ExecutorRate, `source='executor_rate'`) vs ExecutorPayout (settlement) vs manual expense — **ExecutorRate is the single P&L salary basis**; payouts are NOT added to P&L; manual salary expenses use `source='manual'` and must not duplicate an executor already covered by a rate. Referral bonus once per payment (`@@unique([sourceType,sourceId])`). `totalSpent` single-writer (cron). `moneyBalance` single-writer (payment/allocation path).
- **Notification hooks:** reuse `EVENT_TO_CATEGORY` events — `billing.invoice_sent/paid/overdue`, `loyalty.tier_upgraded/discount_applied`. New events needed (`wallet.credited/debited`, `payment_confirmed`) must be added to `EVENT_TO_CATEGORY` + `NotificationEvent` enum or mapped to existing `billing.*`. Prefer **outbox (in-tx) for money events** (durable, replay-safe) over fire-and-forget; crons use `dispatchNotification` fire-and-forget.

---

## 4. First Increment (build immediately)

**Build S5-01 first** — `@workflo/payments` provider + ManualProvider + race-guard contract. It has zero DB/migration dependency, is pure-package (fast vitest, no RLS setup), and is the type-level contract every payment write in S5-02 imports. Building it first lets the migration (`s5_00`) be authored in parallel by another stream without blocking.

**Exact S5-01 deliverables:**

1. `packages/payments/src/PaymentProvider.ts` — extend interface: required `confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>`; optional `createPaymentLink?`, `handleWebhook?`, `verifySignature?`, `refund?`. `ConfirmPaymentInput { amount: number; currency: string; idempotencyKey: string; externalRef?: string; note?: string }`. `ConfirmPaymentResult { ok: boolean; providerPaymentId: string | null }`.
2. `packages/payments/src/ManualProvider.ts` — implement `confirmPayment` returning `{ ok: true, providerPaymentId: null }`; guard `amount > 0` (throw on non-positive); no other side effects.
3. `packages/payments/src/RaceGuard.ts` — export `interface RaceGuard { runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> }` + an `InMemoryRaceGuard` test double (single-flight per key). DB-backed impl lives in apps/api (must not import Prisma here).
4. `packages/payments/src/index.ts` — export all.

**S5-01 TEST LIST (`packages/payments/__tests__/`, vitest):**

- `ManualProvider.confirmPayment` valid input → `{ ok: true, providerPaymentId: null }`.
- `ManualProvider` non-positive amount → throws.
- Type conformance: stub provider implementing all optional methods compiles.
- `InMemoryRaceGuard.runExclusive(sameKey, …)` concurrently → `fn` invoked exactly once, both callers get the same resolved value.
- `runExclusive` distinct keys → both `fn` run.
- `runExclusive` propagates `fn` rejection to all waiters and does not cache the failure (next call re-runs).

This unblocks S5-02 immediately while the `s5_00_financial_core` migration is authored in parallel.

---

### Critical Files for Implementation

- /Users/monstermac/WebstormProjects/workflo_space/packages/db/prisma/schema.prisma
- /Users/monstermac/WebstormProjects/workflo_space/packages/payments/src/PaymentProvider.ts
- /Users/monstermac/WebstormProjects/workflo_space/apps/api/src/routes/orders/transitionOrderStatus.ts
- /Users/monstermac/WebstormProjects/workflo_space/packages/types/src/schemas/billing.schema.ts
- /Users/monstermac/WebstormProjects/workflo_space/apps/api/src/cron/index.ts (new; create with S5-03a)
