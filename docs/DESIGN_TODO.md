# WORKFLO.SPACE — Дизайн: список на допрацювання (handoff дизайнеру)

> 🔄 **ОНОВЛЕНО 2026-06-20 — R7-design ДОСТАВЛЕНО.** Дизайнер повернув новий бандл [`design-v2/`](../design-v2/) (через Claude Design MCP), що реалізує спеку 29 модулів (`DESIGN_TZ_2026-06` / `DESIGN_SPEC_FULL`): **фінмодель 2.0, Проєкт/Клієнт 360°, дошка задач, order-chat, EU-документи, хаби + рольова IA**. **Статус «дизайн закрито на повному скоупі» (нижче) — застарілий**; актуальна матриця готовності (дизайн✅ × бекенд) — [`DESIGN_SYSTEM.md §5.13`](DESIGN_SYSTEM.md). Нижче лишаються тільки реальні дизайн-гапи + R7-SaaS (deferred).

> 🟢 **ЄДИНИЙ ПОВНИЙ HANDOFF — [`DESIGN_SPEC_FULL.md`](DESIGN_SPEC_FULL.md)** (один файл, ВСІ 29 модулів:
> база + усі правки, інвентар екранів + що допрацювати). Дизайнер відкриває **його**. Файли нижче — допоміжні джерела.
>
> ⚠️ **Деталі нових екранів — [`DESIGN_TZ_2026-06.md`](DESIGN_TZ_2026-06.md)** (нові/змінені екрани
> з проходу власника по 29 модулях, 11-12.06; консолідовано в DESIGN_SPEC_FULL). Цей файл (v7.0, 02.06) — **MVP-handoff ДО проходу**;
> «повністю закрито» стосується лише MVP-обсягу. Новий обсяг (фінмодель 2.0, картка клієнта 360°,
> проєкти, юр-особи, документи UA/EU…) — у DESIGN_TZ_2026-06. Читати обидва: цей = MVP-база,
> DESIGN_TZ_2026 = розширення.
>
> **Призначення:** цей файл передається дизайнеру. Тут — тільки те, **чого бракує в дизайні** і що треба домалювати.
> Аналіз «що вже є» + статус коду — в [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Код-задачі сюди не пишемо.
> Версія: 8.0 · **R7-design доставлено (`design-v2/`, 2026-06-20)** — розширення реалізовано · готовність × бекенд → `DESIGN_SYSTEM.md §5.13` · попередня v7.0 (MVP-обсяг) — 2026-06-02

---

## 🎉 Підсумок: MVP-скоуп закрито (R1–R6) → розширено в R7-design

Після **6 раундів** усі дизайн-задачі для MVP + модулів 26-29 + white-label завершені. **R7-design (2026-06-20)** додав розширення власника (fin-model 2.0, 360°-картки, board, order-chat, EU-docs, hubs, рольова IA). Дизайн-гейт відкритий; реальний блокер тепер — **бекенд** для частини модулів (`DESIGN_SYSTEM.md §5.13`).

| Раунд    | Дата           | Пакет                                                                                                                                                                                                                                                     | Статус   |
| -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1       | 2026-05-29     | G1 emails · G2 blog · G3 pricing+legal · G4 ws blog/cases+credentials                                                                                                                                                                                     | передано |
| R2       | 2026-05-29     | G1–G4 ✅ + bonus (15 emails, onboarding, services-admin, etc.)                                                                                                                                                                                            | ✅       |
| R3       | 2026-05-31     | G5–G10 + M1–M5 ✅ + bonus (AgencySwitcherPop, public booking, **інтерактивний прототип**)                                                                                                                                                                 | ✅       |
| R4       | 2026-06-01     | G11–G19 + M6–M10 ✅ (Mobile Workspace, signing UX, refunds, bulk, search, bot, DLQ, integrations, trash, executor settings, etc.)                                                                                                                         | ✅       |
| R5       | 2026-06-02     | Verification only — дизайн без змін; документація виросла → нові гапи виявлено                                                                                                                                                                            | ⓘ        |
| R6       | 2026-06-02     | **G20 Leads · G21 Integrations-full · G22 Client Mgmt · G23 Support · G24 SaaS white-label config ✅** + bonus (Portal /support, +5 WORKSPACE_NAV пунктів)                                                                                                | ✅       |
| R7       | _deferred_     | **SaaS-enablement** (signup · plan tiers · SaaS billing · paywall · per-agency limits · super-admin · email-to-task) — owner's choice                                                                                                                     | ⏸ потім  |
| **R7-D** | **2026-06-20** | **design-v2 доставлено** — fin-model 2.0 · Проєкт/Клієнт 360° · board · order-chat · EU-docs · service-catalog · notifications · hubs · рольова IA (owner/manager/executor). Реалізує `DESIGN_TZ_2026-06`. Готовність × бекенд — `DESIGN_SYSTEM.md §5.13` | ✅       |

---

## Round 6 — підсумок (що повернулось)

Усі 5 пакетів отримали окремі файли + nav-пункти.

| #   | Пакет                            | Файл                                                                            | Що повернулось                                                                                                                                                                                     |
| --- | -------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G20 | 🎯 Leads (модуль 26)             | [`workspace-leads.jsx`](../design-v2/project/workspace-leads.jsx)               | A1 канбан з 10 source-іконок · A2 картка ліда (2-col, timeline, «Зробити клієнтом» modal) · A3 pipelines editor (CRUD + drag-order + isDefault)                                                    |
| G21 | 🔌 Integrations-full (модуль 27) | [`workspace-integrations.jsx`](../design-v2/project/workspace-integrations.jsx) | 4 таби: **API-keys** (CRUD + show-once reveal) · **Site-form** (snippet + CORS + recent leads) · **Channels** (6 adapter-cards) · **Webhooks** (delivery log + retry + DLQ)                        |
| G22 | 👥 Client Management (модуль 28) | [`workspace-clients.jsx`](../design-v2/project/workspace-clients.jsx)           | C1 список · C2 6-tab картка · C3 reset-password modal (link/temp) · C4 deactivate + GDPR експорт                                                                                                   |
| G23 | 🎫 Support (модуль 29)           | [`workspace-support.jsx`](../design-v2/project/workspace-support.jsx)           | D1 portal 3 екрани (списoк/new/thread, public-only) · D2 workspace queue + ticket з internal-notes + SLA-timer + «Створити замовлення з тікета» + chat-hub інтеграція                              |
| G24 | 🎨 SaaS white-label (E1–E5)      | [`workspace-branding.jsx`](../design-v2/project/workspace-branding.jsx)         | E1 branding (live preview, 6 accent-presets + custom) · E2 domain (CNAME wizard + SSL status) · E3 landing-CMS (drag + SEO + draft/published) · E4 client-portal config · E5 2 brand variants demo |

**Bonus від дизайнера:**

- **Portal `/support`** — окремо запропонував для клієнтського доступу (3 екрани: list/new/thread); раніше в брифі це було там же, але виділив у окремий компонент `PortalSupport`
- **Token-driven white-label demo** — 2 живі бренд-варіанти (lime workflo vs indigo Acme) показані поруч у E5
- **6 accent-пресетів** в E1 (lime/indigo/amber/cyan/rose/emerald) + custom-picker

**Nav розширено (r6):**

- **PORTAL_NAV** +2: `support` (з badge), `integrations`
- **WORKSPACE_NAV** +5: `leads` (з accent-badge 6), `support` (з badge 3), оновлено `integrations` (`/admin/integrations`), `branding` (White-label)

---

## Що ще лишилось пропрацювати

### 0. Design-v2 — залишкові дизайн-гапи (2026-06-20)

Знайдено аудитом накладання design-v2 на спеку. Дрібні, не блокують Хвилю-1:

- [ ] **`/projects/:id`** (НОВИЙ операційно-фінансовий екран, `DESIGN_TZ_2026-06 §2.3`) реалізовано в модулі **project360**, а не в client360 — підтвердити, що так і задумано (у client360 рядки проєктів = click-through).
- [ ] **Attention / risk-дашборд** (агрегація at-risk клієнтів, `28-Г`) — окремого екрана нема, є лише бейджі ризику в `C360Overview`.
- [ ] **GDPR-export action** (видалення члена з referral-звʼязком, `§1.0`/`§1.2`) — деталізувати флоу.
- [ ] **Кастомні колонки board** — дизайн дає кастомні колонки, бекенд має лише фіксований enum `InternalTaskStatus` (рішення: модель колонок чи лишити фікс).

### 1. Round 7 — SaaS-enablement (deferred)

Не блокує жодну поточну розробку. Розморожуємо тільки якщо/коли власник вирішить продавати workflo як SaaS-платформу стороннім агенціям.

Перевірочні питання перед R7:

- [ ] Workflo піде як SaaS — продаж агенціям-клієнтам?
- [ ] Модель: agency-as-tenant?
- [ ] Тіри: Free / Pro / Team / Enterprise — структура і ліміти?
- [ ] Платіжний провайдер для SaaS-підписки: Stripe / LiqPay / обидва?
- [ ] Триал: модель?
- [ ] Чи потрібен Super-admin (workflo team UI, окремо від agency-owner)?

Пакети R7 (orientiri):

- **S1** Public signup (нова агенція реєструється)
- **S2** SaaS pricing tiers (Free/Pro/Team/Enterprise — для самого workflo)
- **S3** SaaS billing dashboard (Stripe-картка, історія SaaS-інвойсів, usage meter)
- **S4** Trial countdown + paywall + upgrade prompts
- **S5** Per-agency limits UI (n orders / n users / storage quota)
- **S6** **Super-admin** (платформний — workflo team бачить усі агенції)
- **S7** Email-to-task forwarding

Детальні брифи готую коли власник дасть відповіді на 5 питань вище.

### 2. Документаційний drift — ✅ закрито (2026-06-02)

- [x] `docs/DESIGN_BRIEF.md` — додано superseded-банер + позначені §1 кольори/типографіка з посиланням на DESIGN_SYSTEM.md
- [x] `docs/IMPLEMENTATION_PLAN.md` — `@react-pdf/renderer` → HTML→Puppeteer (toolkit DocBrand/DocParties/DocSigs/DocFoot)
- [x] `docs/CONCEPT_v2.md` + `docs/MONOREPO_SCAFFOLD.md` + `docs/README.md` (tech-стек) — react-pdf оновлено на Puppeteer
- [x] `docs/modules/06-documents.md` — добавлено посилання на дизайн + позначено старий react-pdf як застарілий
- [x] `docs/modules/08-email.md` — додано секцію §1.1 з 11 запланованими шаблонами + mapping на події нотифікацій + посилання на дизайн
- [x] `docs/modules/11-content-blog.md` — ✅ було вже оновлено (REWRITE-done 1.06, drift-banner)
- [x] `docs/modules/09-referral.md` — ✅ було вже оновлено (1.06 doc-sync з аудит-секцією)
- [x] `docs/README.md` — ✅ модульна таблиця вже актуальна (29 модулів зі sprint-таргетами)

### 3. Out-of-scope / Phase 3+ (не зараз)

Документую тут, щоб не загубити, але це **не блокери**:

- Status / health public page (`status.workflo.space`)
- API documentation page (для майбутніх клієнтів-розробників)
- Help / keyboard shortcuts cheatsheet overlay
- Marketplace of integrations
- Onboarding for new EXECUTOR joining workspace (паралель до M8)
- Tags management page (зараз inline — M2)
- Document templates editor (custom PDF layout поверх G5 branding)
- Two-factor backup codes view
- Public profile page для executor (showcase work)

---

## Рамки стилю (на майбутні раунди)

Повні токени — [`DESIGN_SYSTEM.md §3`](DESIGN_SYSTEM.md) / [`design-v2/project/styles.css`](../design-v2/project/styles.css):

- **Усе на `--wf-*` токенах** — особливо критично для white-label (G24)
- Акцент: лайм default; 6 пресетів (lime/indigo/amber/cyan/rose/emerald) + custom-picker через E1 branding
- Нейтралі: stone `#FAFAF9` / `#0C0A09`
- Шрифти: Geist · JetBrains Mono · Caveat
- Естетика: термінал A
- Локалі: Portal — UA+EN, Workspace — UA only
- Орієнтир: інтерактивний прототип `design-v2/project/workflo-prototype.html` (159 файлів)

---

_Дизайн закрито на повному скоупі. Передається дизайнеру лише за наявності нових вимог або при розблокуванні R7 (SaaS-enablement)._
