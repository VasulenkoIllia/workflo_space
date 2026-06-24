# Харден-гейт модуля (фінальний тест + полір front+back) — workflo.space

> Версія 1.0 · 2026-06-15 · канон процесу «коли і як прицільно тестувати готовий модуль».
> Зв'язані: [`TRACKER.md`](TRACKER.md) (черга хардену) · [`DESIGN_SPEC_FULL.md`](DESIGN_SPEC_FULL.md) (Gate-2) ·
> [`PROJECTS_SPEC.md`](PROJECTS_SPEC.md) (P-1, чому fin-coupled чекає) · [`adr/008-saas-module-packaging.md`](adr/008-saas-module-packaging.md) (класи/граф).

> **Правило в одну фразу:** модуль хардениться **рівно один раз** — у той самий тиждень, коли його бек-контракт
> «замерз», дизайн усіх екранів = `РЕЮЗ`, і власник прийняв функціонал. До цього — тільки стійкі бек-тести
> (RLS/ролі/гроші). Після цього — заборонено чіпати модуль без нового харден-циклу.

---

## A) КОЛИ — вхідний гейт (entry gate)

Модуль заходить у фінальний харден-проход **тільки якщо одночасно виконані ВСІ 3 умови**. Не «2 з 3», не «майже».

| Gate                         | Умова                                                     | Як перевірити (об'єктивно)                                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gate-1 — контракт замерз** | Бек-схема/роути модуля не зміняться найближчим рефактором | У матриці нижче `coupledToFinModel: false` **АБО** P-1 (`Project`) вже змержено в `dev`. `prisma migrate diff --exit-code` = 0 (нема дрейфу).                                                                       |
| **Gate-2 — дизайн застиг**   | Усі екрани модуля = `РЕЮЗ`                                | У [`DESIGN_SPEC_FULL.md`](DESIGN_SPEC_FULL.md) §модуля жодного `РОЗШИР`/`НОВЕ`; блок «Що перевірити» порожній; є JSX-артборд у `design-v2/project/*.jsx`; намальовані стани empty/loading/error/permissions/mobile. |
| **Gate-3 — власник прийняв** | Поведінка фінальна, ТЗ закрите                            | Ручний тест-план модуля (стиль [`S5_MANUAL_TEST_PLAN.md`](S5_MANUAL_TEST_PLAN.md)) пройдено; власник підтвердив.                                                                                                    |

**Чому НЕ раніше = марна робота.** Зараз 7 із 7 модулів критичного шляху ще `РОЗШИР`/`НОВЕ`, а P-1 перейменує
`CompanyService→Project`, переб'є роути й переструктурує таблиці під проєкт-селектор → ~80% тестів на них перепишеться.

**Чому НЕ пізніше = дорого.** Без регрес-локу сусідні PR тихо дрейфлять поведінку модуля; коли врешті сядеш
хардени — спершу доведеться відновлювати, «як воно мало працювати». Гейт ставиться **у тиждень збігу 3 умов**, не «колись».

---

## B) DEFINITION OF DONE модуля (чек-лист хардену)

Модуль «hardened» тільки коли всі 4 блоки зелені.

**B1. Бек — фундамент (найдешевший, найстійкіший).**

- [ ] Integration-тест роутів у `apps/api/tests/integration/<module>.test.ts` на **живому PG16** (не мок).
- [ ] **Tenant/RLS** (еталон [`tenantIsolation.test.ts`](../apps/api/tests/integration/tenantIsolation.test.ts)): чужий `agencyId` → `findMany` 0 рядків як `workflo_app`; `update` чужого → 0 affected (P2025); `WITH CHECK` violation на INSERT з чужим `agencyId`.
- [ ] **Гроші-інваріанти** (модулі 05/09/12/19/22/25 — еталон [`allocation.test.ts`](../apps/api/tests/integration/allocation.test.ts)): `FOR UPDATE`, `Σ allocated ≤ payment.amount`, баланс = Σ(confirmed) − Σ(charges).
- [ ] **Idempotency** на платіжні/мутаційні роути: повтор того ж `Idempotency-Key` → один ефект.
- [ ] **Migration smoke:** `prisma migrate deploy` на чистій БД = 0 помилок; `migrate diff --exit-code` = 0.

**B2. Фронт — тільки на `РЕЮЗ`-екранах (інакше пропустити).**

- [ ] RTL+MSW на ключові екрани (`apps/portal/src/__tests__/*` / `apps/workspace/...`): рендер полів → submit → правильний POST → error-toast на 4xx → редірект на success. (Замінює наявну заглушку `vitest run --passWithNoTests`.)
- [ ] **E2E 1–2 критичні флоу** (агент `e2e-runner`, Playwright) у `e2e/<module>.spec.ts`. Селектори **лише** `data-testid`/`role`/URL — ніколи клас чи `nth-child`.
- [ ] **a11y-базово:** навігація по `role`/`aria-label`, фокус-порядок форм.

**B3. Полір-петля — заради чого все й затівається.**

- [ ] Стани кожного екрана: empty · loading · error · permissions(роль) · mobile — реалізовані й покриті тестом стану.
- [ ] UX-доробки з ручного тест-плану закриті; «зручність» (звороти, фокус, помилки українською) внесена.

**B4. Регрес-лок — щоб не зламали завтра.**

- [ ] Нові тести гейтять у `ci.yml` (`pnpm turbo test`) і `db-gate.yml` (`RUN_DB_TESTS=1`, `test:integration`).
- [ ] Snapshot критичних контрактів (audit-log shape, payment-provider response).
- [ ] Модуль помічено `hardened` у трекері. Будь-яка наступна зміна = **новий повний харден-цикл**, не патч повз гейт.

---

## C) ЯК — механіка проходу (послідовність + виконавці)

Один прохід на модуль, строго по порядку. Не починати, поки не пройдено A.

1. **Заморозка контракту** — зафіксувати схему Prisma + роути; `migrate diff --exit-code` = 0. Є дрейф → **стоп, ще рано**.
2. **Бек-тести** — агент `tdd-guide`: `apps/api/tests/integration/<module>.test.ts` (RLS + гроші + idempotency) + unit. Цикл тест→`pnpm --filter @workflo/api test`→фікс→зелено.
3. **Фронт-тести** — `tdd-guide` (RTL+MSW на `РЕЮЗ`-екрани) + `e2e-runner` (E2E 1–2 флоу на живому `portal:3001`/`workspace:3002`).
4. **Полір-петля** — прогнати ручний тест-план, закрити UX-гапи й стани empty/error/loading/mobile; кожен фікс під тест стану.
5. **Фінальне рев'ю** — `typescript-reviewer` (типи/контракти/no-`any`) + `code-reviewer` (логіка, IDOR/`can()`, читабельність). Блокуючий крок.
6. **Фіксація в CI** — переконатися, що нові тести реально гейтять: `ci.yml`→`turbo test`; `db-gate.yml`→`test:integration` з `RUN_DB_TESTS=1`; новий integration-файл матчиться патерном `test:integration`.
7. **Мітка `hardened`** у трекері (черга нижче). Наступна зміна → новий цикл A→C.

---

## D) ПОРЯДОК — 3 хвилі (черга хардену)

Подієва черга, **не розклад**: модуль витягується, щойно його 3 гейти зійшлися. Хвиля = коли гейти стають досяжні.

### Хвиля 1 — можна ЗАРАЗ / найближчим часом

`coupledToFinModel: false`, стабільні, фінмодель не чіпає.

| Модуль               | Стан                             | Тригер старту                                                                   |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| **07 Notifications** | stable · now                     | Gate-2 (екрани 07 → РЕЮЗ) + Gate-3                                              |
| **13 Settings**      | stable · now (вже RLS)           | Gate-2 + Gate-3                                                                 |
| **16 Search**        | now (UI над готовим Meilisearch) | Gate-2 + Gate-3                                                                 |
| **01 Auth**          | after-design                     | щойно magic-link/passkeys/lockout/mustChangePassword стануть `РЕЮЗ` (не раніше) |

### Хвиля 2 — після того, як P-1 (`Project`) у `dev`

Усі `coupledToFinModel: true`. До P-1 **чіпати заборонено** — контракт ще зміниться.

| Порядок | Модуль                                    | Залежність                                        |
| ------- | ----------------------------------------- | ------------------------------------------------- |
| 1       | **05 Billing**                            | корінь рефактора (P-1/P-2/P-4/P-5)                |
| 2       | **02 Orders**                             | 05-ПРОЕКТИ (кошторис 02-Б, гейти оцінки/авансу)   |
| 3       | **06 Documents** (+ **20-Д** LegalEntity) | Project + юр-особа + payment-terms (P-1б/P-3/P-4) |
| 4       | **12 Team & Executors**                   | `ExecutorRate.hourlyRate`, 3 компенс-моделі (P-5) |
| 5       | **22 Finance & Expenses**                 | cost allocation / маржа per-проєкт (P-9)          |
| 6       | **25 Wallet**                             | автосписання per-проєкт (P-4/P-8)                 |
| 7       | **09 Referral**                           | маржа-бонус залежить від 05/P-9                   |
| 8       | **19 Reports**                            | звіти маржі/собівартості (22 + P-9)               |
| ↔       | **28 Client Management** (Картка 360°)    | синхронно з Хвилею 2 — таб «Проєкти» = 05         |

### Хвиля 3 — optional / після свого дизайну (пізніше)

Поза критичним шляхом фінмоделі.

`03 Chat` · `04 Files` · `08 Email` · `10 Loyalty` · `11 Content/Blog` · `14 Landing` · `15 Telegram Bot` ·
`17 Credentials Vault` · `18 Chat Hub` · `20 Admin Settings` (20-Д витягується раніше — передумова 06) ·
`21 System Monitoring` · `23 Leave` · `24 Calendar` · `26 Leads` · `27 Integrations` · `29 Support`.

---

## E) АНТИ-ПАТЕРНИ + обов'язковий мінімум

**Жорсткі заборони:**

1. **НЕ хардени fin-coupled модуль до P-1** (05/02/06/12/22/25/09/19/28). Рефактор перепише роути й таблиці.
2. **НЕ писати крихкі тести до фіналу дизайну:** пікселі/hex (`background-color rgb(...)`), `margin-top: 16px`, DOM-індекси (`:nth-child(2)`), утиліти-класи (`.mt-4`), `querySelector('button')`. Координатор зсуне padding 12→16 — і вони впадуть пачкою.
3. **НЕ полірувати `РОЗШИР`/`НОВЕ`-екран** (якщо «Що перевірити» ще не порожній) — робота на викид.
4. **НЕ робити точковий патч повз харден-цикл** у вже-`hardened` модуль — тихо ламає регрес-лок.

**Мінімум, що пишемо ВІДРАЗУ — навіть до хардену** (стійке до будь-якого редизайну, бо про дані й доступ, не про верстку):

- **Тенант-ізоляція на беку** — для кожного нового роуту (стиль `tenantIsolation.test.ts`). P1 hard-gate.
- **Доступ/ролі на беку** — `can()` + IDOR-гарди (403 виконавцю де лише owner/manager; 401 без auth).
- **Гроші-інваріанти** — `FOR UPDATE` + баланс-інваріант на будь-який роут, що рухає гроші.
- На фронті завчасно — лише `data-testid` + `role`/`aria-label` на ключові вузли (таби, ролеві гейти, бейджі). Behavioral-тести на них переживуть редизайн.

---

## Підсумкова матриця рішення

| Питання                       | Відповідь одним рядком                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Коли можна?**               | Gate-1 (контракт замерз / P-1 в dev) + Gate-2 (всі екрани РЕЮЗ) + Gate-3 (власник прийняв) — усі три. |
| **Що зараз (Хвиля 1)?**       | 07, 13, 16; 01 — щойно auth-дизайн стане РЕЮЗ.                                                        |
| **Що після P-1 (Хвиля 2)?**   | 05→02→06(+20-Д)→12→22→25→09→19; 28 синхронно.                                                         |
| **Що пізніше (Хвиля 3)?**     | 03,04,08,10,11,14,15,17,18,20,21,23,24,26,27,29.                                                      |
| **Що писати вже, до всього?** | Тенант-RLS + ролі/IDOR + гроші-інваріанти на беку; `data-testid`/`role` на фронті.                    |
| **Чого ніколи?**              | Харден fin-coupled до P-1; піксель/DOM-індекс/hex-тести; полір РОЗШИР/НОВЕ; патч повз гейт.           |

---

## Класифікація 29 модулів (джерело хвиль)

| #   | Модуль             | Клас      | fin-coupled | Зрілість    | Харден-готовність             |
| --- | ------------------ | --------- | ----------- | ----------- | ----------------------------- |
| 01  | Auth               | spine     | ні          | in-flux     | after-design                  |
| 02  | Orders             | work-core | **так**     | in-flux     | after-finmodel                |
| 03  | Chat & Comments    | work-core | ні          | in-flux     | after-design                  |
| 04  | Files & Storage    | work-core | ні          | in-flux     | after-design                  |
| 05  | Billing            | spine\*   | **так**     | not-started | after-finmodel (корінь)       |
| 06  | Documents          | work-core | **так**     | not-started | after-finmodel                |
| 07  | Notifications      | spine     | ні          | stable      | **now**                       |
| 08  | Email              | optional  | ні          | in-flux     | after-design                  |
| 09  | Referral           | optional  | **так**     | stable      | after-finmodel                |
| 10  | Loyalty            | optional  | ні          | in-flux     | after-design                  |
| 11  | Content & Blog     | optional  | ні          | in-flux     | after-design                  |
| 12  | Team & Executors   | work-core | **так**     | in-flux     | after-finmodel                |
| 13  | Settings           | spine     | ні          | stable      | **now**                       |
| 14  | Landing            | optional  | ні          | in-flux     | after-design                  |
| 15  | Telegram Bot       | optional  | ні          | stable      | after-design                  |
| 16  | Search             | spine     | ні          | in-flux     | **now**                       |
| 17  | Credentials Vault  | optional  | ні          | in-flux     | after-design                  |
| 18  | Chat Hub           | optional  | ні          | in-flux     | after-design                  |
| 19  | Reports            | spine     | **так**     | in-flux     | after-finmodel                |
| 20  | Admin Settings     | spine     | ні          | in-flux     | after-design (20-Д раніше)    |
| 21  | System Monitoring  | optional  | ні          | not-started | after-design                  |
| 22  | Finance & Expenses | work-core | **так**     | not-started | after-finmodel                |
| 23  | Leave Tracking     | optional  | ні          | in-flux     | after-design                  |
| 24  | Calendar           | optional  | ні          | in-flux     | after-design                  |
| 25  | Wallet             | optional  | **так**     | in-flux     | after-finmodel                |
| 26  | Leads              | optional  | ні          | in-flux     | after-design                  |
| 27  | Integrations       | optional  | ні          | in-flux     | after-design                  |
| 28  | Client Management  | spine     | ні          | not-started | after-design (синхр. Хвиля 2) |
| 29  | Support            | optional  | ні          | not-started | after-design                  |

\* 05 Billing функціонально — core spine фінансів; «корінь» рефактора P-1, хардениться першим у Хвилі 2.
