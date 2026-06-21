# 🔎 Аудит стану — Sprint 5.6 «Фінансова модель 2.0» + перші екрани (2026-06-21)

> Канон-запис аудиту. Метод: 5-вимірний (security · finance · types · frontend · docs),
> кожна знахідка верифікована проти реального коду (zero-false-positive). Гілка `dev`.
> Базовий гейт на момент аудиту: **type-check ✅ · lint ✅ · api 425 unit ✅** (148 gated
> integration пропущено — потребують реального PG). Це запис ЗНАХІДОК; статус виправлень —
> у `TRACKER.md` (нова секція AR-S5.6).

Скоуп: щойно приземлене — S5.6 backend (P-0…P-11, MOD-1…MOD-4) + перші фронт-екрани
S5-11/S5-12 (portal/workspace `/billing`, workspace `/projects`, `GET /workspace/companies`)

- `design-v2/` як новий канон дизайну.

---

## ✅ РЕМЕДІАЦІЯ S5.6-AR ВИКОНАНА (2026-06-21)

Рішення власника: **(1) повний finance-блок для `manager`** (канон MOD-4); **(2) усі верифіковані
фікси одним проходом**. Виправлено й перевірено (гейт зелений: type-check 23/23 · lint 14/14 ·
api **425** unit · build 14/14):

- **H1/M1 manager-блок** — `billing/projects.ts` (`assertInternal`+agencyId, 6 call-sites),
  `billing/estimates.ts` (4 хендлери), `company/listCompanies.ts`, `company/requisites.ts`
  (workspace GET) тепер `|| isAgencyManager(...)` як решта finance-роутів. owner/executor проходять.
- **H2** — `chargeApproval.ts` віддає нормалізований DTO (Decimal→toFixed2, Date→ISO); фронт
  `DecidedCharge`-тип (portal+workspace). Тест-mock виправлено на `Prisma.Decimal` (вірно до prod).
- **H3** — `FinProject` доповнено 5 полями (type/legalEntityId/contractDocumentId/requiresApproval/advanceGatePct).
- **H4** — `formatMoney` гард `Number.isFinite` (no more `$NaN`).
- **H5** — обидва `ChatTab` mark-read deps `[orderId]` (без write-storm).
- **M2** — ProjectsPage опція «Успадкувати»→`null` (каскад Company→Agency не ламається).
- **M3/M4** — `chargeDiscount` 409 на pending-чернетку + на кредит-рядок (negative net).
- **M5** — `project.schema` currency = `billingCurrency` enum + ProjectsPage валюта `<Select>` USD/UAH/EUR.
- **M6** — спершу прибрано мертвий `/settings` nav-пункт; **далі (2026-06-21) збудовано повноцінний workspace `/settings`** (owner-config: платіжні реквізити + реферальна програма) → nav-пункт повернено на реальний екран.
- **M7** — OwnerDashboard показує помилку запиту «непризначені» (не ховає як 0).
- **M8** — явна ISO-серіалізація дат (`charges.toDto`, `portalSummary.nextCycleAt`).
- **L3** — close-cycle NaN-гард на дати (400 замість 500).
- **M9** — фактично покрито глобальним `MutationCache.onError` toast (без правок).
- **L1/L5** — лишені як housekeeping (захисні/косметичні, не блокують).

Code-review змін (adversarial) — 0 crit/high після фіксу UI-валюти. Нижче — оригінальний запис знахідок.

---

## ✅ Що ПІДТВЕРДЖЕНО коректним (не чіпати)

**Фінансове ядро — інваріанти цілі (0 crit/high у грошах):**

- Draft-exclusion: `LIVE_CHARGE_APPROVAL` ({approvalStatus IS NULL OR approved}) застосовано
  скрізь, де чернетка `on_actuals` могла б протекти в гроші — `recomputeMoneyBalance` (raw SQL),
  FIFO `allocatePayment` (+ повторна перевірка `charge.approvalStatus` під локом), `margin`,
  `statement`, P&L. Покриття повне.
- Counter-offer math: `billed = totalAmount ?? amount`; guard `offered > billed → 400`;
  при погодженні знижується лише `totalAmount`, `amount` (quote) зберігається. Без подвійного
  рахунку/знаку.
- recurringCharges P-7 catch-up: in-run буфер (`runRows`) коректно знаходить advance того ж
  прогону до вставки → подвійне нарахування неможливе; `@@unique([projectId,periodStart,kind])`
  - `skipDuplicates` дають ідемпотентність.
- Decimal-дисципліна: жодного `Number()`/float у грошовій арифметиці; 2 `Number()` лише на
  порогах лояльності/реферала проти безпечних цілих ($1k/5k/15k).
- Bonus-ізоляція (`amountUsd=0`), payout-ідемпотентність + period-lock, loyalty upgrade-only
  (ніколи auto-downgrade), контракт-гейт — усі коректні.

**Безпека — підтверджено безпечним:**

- Charge-approval IDOR: `decideCharge` завжди `{id, agencyId}` + `memberships.find(companyId)`
  → клієнт компанії A не погодить charge компанії B.
- Channel-confusion: `chargeApprover(charge) !== channel → 400` перед будь-якою мутацією.
- Concurrent-approval: `updateMany(where approvalStatus:'pending')` + `count===0` guard — коректний optimistic-lock.
- **`createPayment.ts` / `allocatePayment.ts` — manager ЗАБЛОКОВАНО** через `can('payment.confirm')`
  (MANAGER_BLOCKED), хоча й немає явного `isAgencyManager`. Не баг.
- Discount-роут — owner-only (`isAgencyOwner`).

---

## 🔴 Знахідки (за серйозністю)

### HIGH

**H1 — Manager обходить finance-гейт на нових S5.6-роутах.**
Встановлений канон (MOD-4): `manager` заблокований від finance/settings. ~13 finance-роутів
послідовно гейтять `if (!isInternalTeam(user) || isAgencyManager(user, agencyId))`
(overview/charges/chargeApproval/listPayments/paymentSettings/adminWallet/statement/payouts/
referral-settings/legalEntities/companyLoyalty/generateCharges). **Нові S5.6-роути цей виняток
НЕ перенесли** — гейтять лише `isInternalTeam`:

- `routes/billing/projects.ts:67` (`assertInternal`) — **усі CRUD + `POST /:id/close-cycle`**.
  Close-cycle найнебезпечніший: `closeProjectCycle()` створює `ServiceCharge` + рушить
  `moneyBalance` — manager може генерувати живі фінрядки.
- `routes/billing/estimates.ts:54,81,103` — POST/PATCH/DELETE estimate-lines (спавнять
  kanban-задачі, лімітують білінг).

Фікс: додати `|| isAgencyManager(user, agencyId)` до гейтів запису. Для READ (GET) — рішення
власника (чи бачить manager конфіг проєктів). **⚠️ Передумова: продуктове рішення про обсяг
доступу manager (див. «Питання власнику»).**

**H2 — Approval-роут віддає сирий Prisma-payload, типізований як повний Charge (контракт-брехня, латентно).**
`routes/billing/chargeApproval.ts` (decide) робить `reply.send({ charge: updated })` із сирим
select — без `toDto()`. Фронт типізує відповідь як `PortalCharge`/`WsCharge`, але реально
бракує ~10 полів (companyId/kind/currency/status/dueDate…) + Decimal не нормалізований
(`.toFixed(2)`). Не падає лише тому, що `onSuccess` робить лише `invalidateQueries` і не рендерить
з відповіді. Один рефактор від рендер-бага. Фікс: прогнати `updated` через `toDto()`.

**H3 — `FinProject` (frontend) без 5 полів, що їх API віддає.**
`apps/workspace/src/lib/projects.ts` `FinProject` декларує 18 полів; API `PROJECT_SELECT`/`toDto`
віддає 23. Бракує: `type`, `legalEntityId`, `contractDocumentId`, `requiresApproval`,
`advanceGatePct`. Перші два — косметика, але `advanceGatePct` (% авансового гейту upfront) і
`requiresApproval` — функціональні: UI не може їх показати/змінити. Персистенс безпечний
(PATCH `...(x!==undefined)` не перетирає). Фікс: дотягнути тип + поля форми.

**H4 — `formatMoney(NaN)` рендерить `$NaN`.**
`packages/app-core/src/format.ts:10` гардить лише `amount == null`; `NaN` (з `num()`=`Number(s)`
на нечисловому рядку) проходить → `"$NaN"` у кожній грошовій клітинці billing/projects. Фікс
(1 рядок): `if (!Number.isFinite(amount)) return '—'`.

**H5 — Chat mark-read write-storm + передчасне позначення прочитаним.**
`{ws,portal}/src/routes/orders/ChatTab.tsx` — `useEffect(..., [orderId, count])`. SSE пушить
нові коментарі → `count` росте → `POST /comments/read` на КОЖНЕ вхідне повідомлення + позначає
прочитаним те, що користувач не бачив. Фікс: позначати раз на `orderId` (прибрати `count` з deps)
або за явним сигналом видимості.

### MEDIUM

**M1 — Manager читає реєстр компаній + юр-PII клієнта.**
`company/listCompanies.ts` (гейт `isInternalTeam`) → manager бачить список компаній (name/tier/
currency). `company/requisites.ts:89` (workspace GET) → manager читає юр-реквізити клієнта
(taxId/IBAN/банк/підписант). Read-only, але це finance/PII за каноном MANAGER_BLOCKED. Залежить
від рішення про обсяг доступу manager (H1).

**M2 — UI завжди шле `approvalMode:'none'` → ламає каскад Company→Agency.**
`ProjectsPage.tsx:91,109` завжди включає `approvalMode: mode` (дефолт `'none'`). `resolveApprovalMode`
трактує `project.approvalMode != null` як «explicit, бери це» → проєкт **закріплює** none навіть
коли Company/Agency мають дефолт. Фікс: опція «успадкувати (за замовч.)» → `null`, або не слати
`approvalMode` коли користувач не чіпав поле.

**M3 — `chargeDiscount` на pending-чернетці без гарду (workflow-hazard).**
`services/chargeDiscount.ts:105` блокує лише allocations>0/written_off, не `approvalStatus==='pending'`.
Знижка на чернетку коректна математично (pending не в `moneyBalance`), але клієнту в погодженні
показується вже-знижена стеля counter-offer — невидимо. Фікс: 409 на pending, або показати знижку в UI.

**M4 — `chargeDiscount` на `prepaid_credit` (negative line) зменшує кредит.**
`chargeDiscount.ts:36` `Decimal.min(positiveDiscount, negativeNet)` на кредит-рядку дає
негативний discount → `totalAmount` стає «менш негативним» → `moneyBalance` занижується.
Потребує свідомої дії owner на кредит-рядку. Фікс: 409 якщо `postLoyaltyNet ≤ 0`.

**M5 — `project.currency` приймає будь-який 3-символьний рядок (не enum).**
`schemas/project.schema.ts:39` `z.string().length(3)` → можна `"GBP"`, який allocation
(`==` currency) ніколи не зматчить → charge замерзає в сетлменті. Фікс: `billingCurrency` enum
(USD/UAH/EUR) з `.default('USD')`.

**M6 — Workspace не має екрана Settings.**
`workspace/config/nav.tsx` лінкує `/settings` (omx), але `App.tsx:45` рендерить `<Placeholder>` —
SettingsPage не існує (на відміну від portal). Мертвий стаб для всіх. Фікс: збудувати або прибрати
пункт нав.

**M7 — Owner dashboard ховає алерт «непризначені» при тихому фейлі вторинного запиту.**
`OwnerDashboard.tsx:11,28` — `useOrders({assigneeId:'none'})` ігнорує `isError`; `?? 0` →
картка зникає, owner бачить неявний «0 непризначених». Фікс: показати помилку вторинного запиту.

**M8 — Дрейф серіалізації дат (фрагільно, працює зараз).**
`charges.ts` `toDto` віддає `dueDate`/`paidAt`/`approvalDecidedAt` сирим `Date` (покладаючись на
Fastify Date→ISO); `portalSummary` так само з `nextCycleAt`. Фронт типізує `string | null`. Працює
випадково; schema-провайдер це зламає. Фікс: явний `?.toISOString() ?? null`.

**M9 — Тихі фейли мутацій (row-deletes/transitions).**
`FilesTab`/`TimeTab` deletes + workspace `OrderDetailPage` status-transition без `onError`
(глобальний `MutationCache.onError`-toast покриває частину, але ці opt-out). Portal stat-tiles
(`OrdersPage`) рахують по сторінці (limit=50), а «всього» — `pagination.total` → клітинки
розходяться при фільтрах/>50.

### LOW

- **L1** `loyaltyRecalc.ts:43` payment-aggregate без `agencyId` (покладається на UUID-унікальність;
  захисний фікс: додати `agencyId: c.agencyId`).
- **L2** `chargeApproval.ts:100` counter-offer може дорівнювати `billed` (`>` замість `>=`) —
  косметика аудит-запису.
- **L3** `projects.ts:366` close-cycle без `isNaN(date)`-гарду (regex блокує більшість; `"2024-02-30"`
  пройде → 500 замість 400).
- **L4** `statement.ts:59` вікно charges по `createdAt`, не `month` — свідомо (ledger), doc-нота.
- **L5** SSE `setQueryData` копіює `meta` незмінним → `meta.unreadCount` застаріває для stream-повідомлень;
  portal `OrderDetailPage` не скидає `tab` при зміні `/orders/:id`; ws release-queue не звужений
  по approver на сервері (кнопка «Випустити» може зрендеритись для client-каналу — лише
  пост-фактум inline-фідбек).
- **L6** `CompanyOption.loyaltyTier` типізований як `string` (не enum) — звузити до `LoyaltyTier`.

---

## 🎨 Покриття design-v2 (frontend)

`design-v2/` = канон (159 файлів, рольова IA owner/manager/executor, 7 хабів). Реалізовано —
**тонкий операційний зріз**; решта свідомо відкладена (бекенд за планом S6–S13).

| Модуль / екран                                                                      | Код                 | Статус                                                   |
| ----------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| auth (login/forgot/reset/invite)                                                    | ✅                  | built                                                    |
| orders registry + board-by-status                                                   | ws/orders           | built (без SLA/tags/bulk)                                |
| order-detail chat/files/time                                                        | ✅                  | built (diverges: без search/pins/reply-quote)            |
| billing (approval/release)                                                          | {ws,portal}/billing | **built, diverges** (одна сторінка, не multi-subtab хаб) |
| projects-config                                                                     | ws/projects         | built (лише фін-конфіг; без wizard/hour-tables)          |
| clients list + 360                                                                  | ws/clients          | thin (orders-derived; без 7 таб 360°)                    |
| dashboards (role-aware)                                                             | ✅                  | built                                                    |
| team / portal settings                                                              | ✅                  | built (team=invite-stub)                                 |
| project360 detail · margin · service-catalog · reports(6) · calendar · testimonials | —                   | **missing** (бекенд далі)                                |
| notifications-center · documents-eu · vault/secrets · support                       | placeholder         | route→Placeholder                                        |

**Найбільший дизайн-розрив:** рольова IA реалізована наполовину. RBAC-гейтинг працює (`RoleRoute`

- `navVisibleForRole`), але **7-хабовий shell (W0) і view-as overlay НЕ реалізовані** — нав плоский;
  view-as існує лише як мертвий CSS (`packages/ui/src/styles/ia-roles.css`). Відповідає memory
  (W0 відкладено до рішення власника про склад 7 хабів).

---

## 📄 Doc-дрейф (виправлено в цьому проході / до виправлення)

- ✅ **PROJECTS_SPEC.md:4** — банер «Реалізація ще НЕ почата / схема ще містить CompanyService»
  (суперечив власному §8 ✅) → виправлено на «BACKEND ЗАВЕРШЕНО».
- ✅ **TRACKER.md** — заголовок «9 червня» + СТАН ЗАРАЗ → 21 червня; додано S5.6 backend +
  S5-11/S5-12 + цей аудит.
- ⬜ **modules/05-billing.md** — найбільший body-дрейф: §2 досі описує `company_services`-таблицю +
  pg_cron як живу модель; стара `ServiceCharge`-схема (`companyServiceId`); видалені роути
  (`/workspace/services/:id/assign`); немає секції P-11; actor-таблиця без `manager`. (Великий
  рерайт — за greenlight власника.)
- ⬜ **SPEC.md:58,177** — `CompanyService` як живий recurring-модель → `Project`.
- ⬜ **DESIGN_SYSTEM.md §5.13** — матриця без колонки «код збудовано?» — не фіксує, що
  billing-approval + projects-config екрани приземлились.
- ⬜ Рольовий словник: `20-admin-settings.md:3` (`superadmin`), `DESIGN_SPEC_FULL.md:1325` (`lead`)
  → `owner/manager/executor`; `SPEC.md:27` role-list без `manager`.

---

## ❓ Питання власнику (блокують частину фіксів)

1. **Обсяг доступу `manager`** до нових S5.6-роутів: повний finance-блок (як канон MOD-4 — тоді
   projects/estimates/companies/requisites закриваємо для manager) — чи manager бачить/керує
   операційним конфігом проєктів (read-only? read-write?), а блок лише на гроші (payments/discount)?
2. Чи застосовувати **верифіковані фікси** (H2–H5, M-серія) зараз окремим коммітом, чи зібрати в
   ремедіацію S5.6-AR разом із рішенням по #1?

---

## Вердикт

Фінансове ядро S5.6 — **математично здорове** (інваріанти, ідемпотентність, draft-ізоляція,
Decimal — усе коректне; 0 crit/high у грошах). Головний ризик — **не математика, а авторизація**:
канонічний finance-блок для `manager` не перенесено на 4 нові роут-файли (H1/M1). Це механічний
фікс, але впирається в продуктове рішення про обсяг ролі manager. Фронт-зріз якісний, але тонкий
відносно design-v2; кілька чітких FE-багів (H4/H5) і контракт-дрейфів (H2/H3) варто закрити до
розширення екранів. Документація — 2 flatly-false банери виправлено; `05-billing.md` лишається
найбільшим body-дрейфом.
