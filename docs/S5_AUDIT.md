# Sprint 5 — Аудит фінансового ядра + ремедіація

> 2026-06-09. 4-вимірний аудит коду S5 (code-quality · security · TypeScript · architecture/decomposition) + наскрізний регресійний sweep S0→S5. Усі підтверджені знахідки виправлено; гейт зелений (type-check 21/21 · lint 13/13 · test api 343 + 57 integration + types 46 · build 13/13). Коміти ремедіації: `6941cd3` (S5), `<regression>` (S0-S5 seam).

## Метод

Чотири паралельні фахові ревʼю всього S5-поверхні (11 сервісів, 7 route-груп / 24 файли, 3 крони, схеми/enum) + два агенти на ширший аудит (deploy-інвентаризація — див. [`SERVER_UPDATE_S5.md`](SERVER_UPDATE_S5.md) — і регресія/інтеграція S0↔S5). Кожному передано контекст свідомих рішень, щоб мінімізувати хибні спрацювання.

## Виправлено (реальні знахідки)

### Money-correctness

- **FP-баг предиката 2-decimal (HIGH).** `Math.round(value*100) === value*100` повертав **false** для валідних сум (`1.12*100 === 112.00000000000001`), відхиляючи `1.12 / 2.01 / 16.01 / …`. → `Number(value.toFixed(2)) === value` у 4 схемах + регресійний тест `money.schema.test.ts`. **Це баг, який міг блокувати реальні платежі.**
- **Referral cross-agency (CRITICAL).** `referredById` на компанію іншої агенції давав (а) cross-tenant aggregate, (б) `walletCredit` з 404 на mismatch агенції → **відкат платежу**. → skip self/cross-agency referral + scope aggregate за `agencyId`.
- **Allocation over-allocation race (HIGH).** Дві паралельні FIFO-алокації різних платежів на той самий charge не серіалізувались (lock лише на payment) → over-cover. → лок company-рядка в `allocatePayment` (order: payment→company; deadlock-free) серіалізує всі алокації компанії + real-PG регресійний тест.
- **`recomputeMoneyBalance` пропускав `totalAmount=null` (MEDIUM).** `_sum.totalAmount` тихо ігнорує null-рядки → завищений moneyBalance. → `COALESCE(totalAmount, amount)` через raw SQL.
- **`paidAt` затирався при ре-derive (HIGH).** → зберігаємо оригінальний timestamp (`charge.paidAt ?? now`).
- **`Number()` на Decimal біля tier-порогів (HIGH).** referral/loyalty: FP-шум на `$1k/$5k/$15k`. → `.toDecimalPlaces(2)` перед `Number()`.
- **bonusSpend повертав перерахований баланс (MEDIUM).** → повертає авторитетний `walletDebit.balanceAfter`.

### Security / privacy

- **pay-with-bonus гейтився read-перміссією (CRITICAL privesc).** `billing.view` (read) дозволяв view-only member-у списувати бонуси. → гейт на **власника компанії**.
- **Витік ЗП (MEDIUM).** `GET /workspace/team` і `GET /workspace/executors/:id/rates` показували компенсацію всім виконавцям. → ЗП лише власнику агенції (rates: owner-or-self).
- **Expense audit (LOW).** PUT/archive не писали audit-лог. → додано.

### Ops / integration

- **Крони без RLS-context (MEDIUM).** recurringCharges/loyaltyRecalc покладались на permissive-when-unset. → `runWithSystemContext` (явний bypass) — коректно після ввімкнення RLS.
- **time-log lock не на CREATE (HIGH, S4-seam).** Лок payout-періоду був на PATCH/DELETE, але не на POST → новий запис у закритому періоді десинхронізує payroll. → `assertNotLocked` у POST + 409-тест.
- **`recomputeMoneyBalance` зайвий export (MEDIUM).** → unexported (footgun lock-ordering).

## Хибні спрацювання (перевірено в коді — НЕ баги)

- **Wallet-adjust cross-tenant IDOR** — сервіс `wallet.ts` уже 404-ить cross-tenant (`company.agencyId !== args.agencyId`).
- **Statement route без tenant-check** — `buildStatement` перевіряє agencyId всередині.
- **Content-Disposition header injection** — `from/to` обмежені strict ISO-date regex (лише цифри+дефіси).
- **IBAN/USDT «секрет»** — це pay-to реквізити, які клієнт МУСИТЬ бачити для оплати; IBAN — receive-only.
- **allocate-array DoS** — `allocatePaymentSchema` уже `.max(100)`.
- **CompanyService без agencyId-фільтра** — у моделі нема колонки `agencyId`; `companyId` session-derived + компанія tenant-перевірена.

## Відкладено свідомо (не баги, follow-up)

- **N+1 у loyaltyRecalc / fifoTargets** — perf-оптимізація (GROUP BY); MVP-scale прийнятно.
- **Декомпозиція/DRY:** консолідація period/date-хелперів (`lib/period.ts`), `assertInternalTeam`/`requirePortalCompany` хелпери, спліт `allocation.ts`, cron-factory — косметика без баг-ризику (дублі коректні). Винесено в backlog.
- **enum-drift inverse-check** (Prisma-only enums: OutboxStatus та ін.) — не S5-специфічно.

## Регресія S0↔S5 — чисто

Route-реєстрація (14 груп, 0 колізій, error-handler останній) · import-граф DAG (payments→referral→wallet, без циклів) · lock-ordering deadlock-free · `// S6:` стаби нічого не enqueue (без DLQ) · усі 8 S5-enum у drift-guard · усі сервіси/маршрути зашиті.

## Addendum — знахідка під час UI-тесту (2026-06-10, P0 infra)

**Global-плагіни не діставали маршрутів через відсутню `fastify-plugin` обгортку (S0-seam, blocker для всього UI).**

- **Симптом:** браузер-логін у портал падав `«No 'Access-Control-Allow-Origin' header»`, хоча curl (без Origin) працював і повертав 200+token.
- **Корінь:** `cors.ts`, `securityHeaders.ts`, `rateLimiting.ts` реєструвались `app.register(plugin)` **без `fp()`** (на відміну від `jwt.ts`). Їхні `onRequest`-хуки лишались в інкапсульованому дочірньому контексті й **не застосовувались до сусідніх route-плагінів**. Preflight маскував баг (глобальний `OPTIONS *` маршрут все одно віддавав ACAO), тому curl-аудит без браузера його не ловив.
- **Наслідок (ширше за CORS):** на КОЖНІЙ реальній відповіді були відсутні (1) ACAO → весь браузер-UI неробочий; (2) helmet-хедери (CSP/HSTS/X-Frame-Options/X-Content-Type-Options) → регресія безпеки; (3) rate-limit → brute-force ceilings (login 10/15m тощо) фактично **не діяли**.
- **Фікс:** обгорнуто всі три у `fp(plugin, { name, fastify: '5.x' })`. Регресія-гард: `tests/globalPlugins.test.ts` (ACAO + CSP + nosniff + x-ratelimit на `GET /health`). Усі 345 юніт-тестів зелені.
- **Урок для аудиту:** curl-перевірки CORS/headers МУСЯТЬ слати `Origin:` і перевіряти **фактичну** відповідь, а не лише preflight. Додано в чек-лист тест-плану.
