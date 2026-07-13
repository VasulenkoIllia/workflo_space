# Coverage-аудит 2026-07-13 — фронт ↔ бек, портал + workspace + налаштування + ENV

> **Що це:** системний прохід покриття після закриття ХВОСТИ-2 (`9f073fa`). Питання власника:
> «чи все готово, всі налаштування, чи є прогалини». Методологія: 4 паралельні рецензенти —
> (1) workspace-покриття: усі fastify-роути ↔ усі `api.*`-виклики workspace/app-core, дифф обома
> напрямками; (2) портал-покриття: те саме для /portal/_ + shared; (3) налаштування: кожне
> settings-поле schema.prisma → роут → UI, плюс `process.env._`↔`.env.example` ↔ доки;
> (4) доки/борги: TRACKER не-✅, ROADMAP-відкладене, TODO-світ, e2e, RLS.
>
> **Загальний висновок:** ядро повне — нуль мертвих викликів з фронта, нуль TODO/FIXME
> у first-party коді, всі домени (гроші/документи/нотифікації/support/календар) працюють.
> Прогалини — по краях: пропущені кнопки, непідключені PATCH-и, недоступні з UI налаштування,
> розсинхрон `.env.example` з кодом. Нижче — все за категоріями з ID для трекінгу фіксів.
>
> **Статуси:** ⬜ відкрито · 🔧 у роботі · ✅ пофікшено (дата) · 🗓 відкладено свідомо (куди)

---

## A. UX-дірки — фактичні розриви флоу (пакет COV-UX)

| ID   | Знахідка                                            | Деталі                                                                                                                                                                                                                                                   | Статус     |
| ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| UX-1 | **Замовлення неможливо видалити**                   | `DELETE /orders/:id` (soft-delete у кошик 30 дн) існує, кошик+restore у UI є (`OrdersPage` TrashModal), але кнопки «видалити» нема ніде — у кошик нічого не потрапляє                                                                                    | ✅ (13.07) |
| UX-2 | **Календар не в сайдбарі workspace**                | `/calendar` зареєстрований у роутері, API повністю споживається, але `config/nav.tsx` не має пункту — сторінка досяжна лише прямим URL                                                                                                                   | ✅ (13.07) |
| UX-3 | **Клієнт погоджує кошторис без позицій**            | На `PENDING_APPROVAL` портал показує лише `totalAmount` + Approve; ітемізація (`GET /orders/:id/estimate`) бекендом віддається, порталом не тягнеться                                                                                                    | ✅ (13.07) |
| UX-4 | **SUPPORT і CALENDAR відсутні в матриці сповіщень** | Типи мають 9 категорій, UI (`app-core/notificationPrefs.ts` NOTIF*CATEGORIES) — лише 7; support.*/calendar.\_ події не можна вимкнути (прибиті до seed-дефолту). PATCH upsert-ить лише надіслані рядки, тож приховані не стираються — але й не керуються | ✅ (13.07) |
| UX-5 | **No-edit патерн: PATCH є, UI нема**                | Подія календаря (`PATCH /calendar/events/:id` — лише create/cancel у UI), time-log (`PATCH /orders/:orderId/time-logs/:logId` — лише create/delete), номенклатура (`PATCH /workspace/nomenclature/:id` — лише create/deactivate)                         | ✅ (13.07) |
| UX-6 | **GDPR-export нема у workspace**                    | `GET /profile/export` існує, кнопка є лише в порталі; workspace ProfilePage без неї                                                                                                                                                                      | ✅ (13.07) |
| UX-7 | **Мертвий `Placeholder.tsx` у workspace**           | `apps/workspace/src/routes/Placeholder.tsx` не імпортується ніде — прибрати                                                                                                                                                                              | ✅ (13.07) |

## B. Налаштування — бек підтримує, UI нема (пакет COV-SET)

| ID    | Знахідка                                     | Деталі                                                                                                                                                                                                    | Статус     |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| SET-1 | **`vacationDaysPerYear` захардкожено на 24** | Leave-accrual читає (`routes/team/leave.ts`), календар відпусток збудований, а змінити квоту можна лише в БД — нема ні роуту, ні UI                                                                       | ✅ (13.07) |
| SET-2 | **Approval-каскад працює на 1 з 3 рівнів**   | Project-override ✅; Agency-floor (`defaultApprovalMode`/`defaultInvoiceApprover`) і per-Company (`Company.approvalMode`/`invoiceApprover`) — без write-роуту і UI, прибиті до дефолтів (`none`/`client`) | ✅ (13.07) |
| SET-3 | **`bonusCurrency` наполовину зашитий**       | Схема+валідація+read є (`billing.schema.ts`, SETTINGS_SELECT), PaymentForm поле не рендерить — заморожено на USD                                                                                          | ✅ (13.07) |
| SET-4 | Шаблони замовлень — частковий редактор       | UI редагує лише name/title/price; `type`, `defaultBillingType`, `defaultStages`, `nomenclatureCode` зі схеми не редагуються                                                                               | ⬜         |
| SET-5 | Агенцію не можна перейменувати               | `name`/`slug` ставляться лише при provisioning                                                                                                                                                            | ⬜         |

## C. Портал (пакет COV-PORTAL)

| ID    | Знахідка                                                | Деталі                                                                                                                                                                                           | Статус     |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| PRT-1 | **Дві живі заглушки в nav**                             | «Моя компанія» (`/company`) і «Інтеграції» (`/settings/integrations`) — клікабельні пункти меню → Placeholder «Розділ у розробці». Інтеграції = модуль 27, відкладений рішенням власника 07.07   | ✅ (13.07) |
| PRT-2 | **`/documents` не під CompanyGate**                     | Company-scoped дані, але роут не загорнутий; безпечно лише випадково (ендпоінт fail-soft-ить `[]` замість 400) — no-company юзер бачить порожній екран замість гейт-стану, непослідовно з рештою | ✅ (13.07) |
| PRT-3 | Осиротілий `GET /portal/billing/payment-settings`       | Реквізити віддаються embedded у `/portal/billing/summary`; standalone-ендпоінт ніхто не кличе — мертвий код                                                                                      | ⬜         |
| PRT-4 | `GET /portal/projects/:id/estimate-lines` без споживача | Клієнт не бачить кошторис проєкту (лише список проєктів). Пов'язано з UX-3                                                                                                                       | ⬜         |

## D. Дрібніші сироти workspace (без пакета — за нагодою)

| ID    | Знахідка                                                                                                          | Судження                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| WS-1  | `PUT /orders/:orderId/tasks/:taskId/assignees` — co-assignees задач без UI (order-рівень є)                       | добудувати з дошкою задач v2                                      |
| WS-2  | Estimate-lines проєкту: read-only у UI, CRUD-роути без редактора (редактор є лише order-рівня)                    | вирішити: чи потрібен project-редактор взагалі, чи прибрати роути |
| WS-3  | `POST /workspace/billing/charges/generate` (bulk із каталогу) — без кнопки                                        | за потреби власника                                               |
| WS-4  | `POST /workspace/billing/payments/:id/allocate` — ручна алокація без UI (авто-алокація працює)                    | за потреби                                                        |
| WS-5  | `GET /workspace/projects/:id/margin` — UI використовує лише company-рівень                                        | за потреби                                                        |
| WS-6  | `GET /workspace/executors/:id/rates` — історія ставок не показується (лише POST нової)                            | картка виконавця v2                                               |
| WS-7  | `GET /workspace/reports/{hours,pnl}.csv` — мертві (UI робить клієнтський CSV через exportTable.ts)                | видалити або лишити для API-споживачів                            |
| WS-8  | `POST /auth/switch-agency` — перемикача агенцій у UI нема (актуально лише при >1 агенції — SaaS-ера)              | 🗓 S14                                                            |
| WS-9  | `POST /auth/magic-link` — LoginPage не пропонує passwordless                                                      | вирішити: чи потрібен у workspace-логіні                          |
| WS-10 | `GET /admin/wallet/companies/:id/statement` — не споживається (є transactions)                                    | за потреби                                                        |
| WS-11 | `POST /company/members/invite` — legacy-дублікат (workspace використовує `/workspace/clients/:id/members/invite`) | перевірити хто кличе (портал TeamPage) перед видаленням           |

## E. ENV / ops (пакет COV-ENV) — ризик на деплої

**Мертві задокументовані змінні** (оператор ставить — ефекту нуль) — ✅ **ВИПРАВЛЕНО 13.07** (`.env.example` + обидва compose, коміт COV-ENV):

| ID    | `.env.example` каже                 | Код читає           | Де                    |
| ----- | ----------------------------------- | ------------------- | --------------------- |
| ENV-1 | `STORAGE_TYPE`                      | `STORAGE_DRIVER`    | `services/storage.ts` |
| ENV-2 | `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | `JWT_EXPIRES_IN`    | `plugins/jwt.ts`      |
| ENV-3 | `OPENAI_API_KEY`                    | `ANTHROPIC_API_KEY` | `services/blogAi.ts`  |

**Читаються кодом, відсутні у `.env.example`** (ENV-4) — ✅ **ДОДАНО 13.07** (`.env.example` + compose-мапінги api/worker): `API_PUBLIC_URL`, `UNSUBSCRIBE_SECRET`,
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (без них push мовчки off),
`INBOUND_IMAP_HOST/PORT/USER/PASSWORD/SECURE/MAILBOX`, `ADMIN_EMAIL` (security: superadmin-allowlist!),
`SMTP_SECURE`, `SMTP_FROM_NAME` (ніде не задокументована взагалі), `PUPPETEER_EXECUTABLE_PATH`,
`BLOG_AI_MODEL`, `RUN_WORKERS_INLINE`, `SENTRY_RELEASE`.

**ENV-5:** `HetznerStorageAdapter` — заглушка 15 рядків без env-читань: об'єктне сховище не
підключене, файли живуть лише на локальному диску (= TRACKER `S10-06` ⬜ S3/R2-адаптер).

## F. Свідомо відкладене (НЕ фіксимо зараз — план)

- **S7:** UA/EN i18n + hreflang + Lighthouse≥90 (останній шматок S7-03).
- **S8 — QA-спринт цілком ⬜:** інтеграційні auth/orders/billing, OWASP security-review,
  моніторинг (uptime/backup-cron), runbook, tag v0.1.0 + production.
- **S14/SaaS:** payments go-live (Monobank/Stripe+вебхуки), плани/ліміти, platform-admin роль
  (blog/testimonials/cms зараз під `isAgencyOwner` — ок до мульти-агенції), landing-CMS,
  per-agency inbound-скриньки, WS-8 перемикач агенцій.
- **Інтеграції (модуль 27)** — API-keys, вебхуки, Telegram-ліди (рішення власника 07.07).
- **E2E тонкий:** 1 smoke-спек (22 сторінки + invoice-флоу). Без покриття: чати/SSE, support,
  календар, vault-reveal, таймер. Фронт-юнітів нема свідомо (рішення власника).
- **RLS:** полісі 100% tenant-таблиць (вкл. `agency_members` — міграція `20260710_agency_members_rls`).
  Лишається лише системний flip `RLS_ENFORCED=true` + `workflo_app`-роль + `DATABASE_APP_URL` —
  «перед першим зовнішнім тенантом». ⚠️ Згадки «agency_members RLS відкрито» у старих аудитах
  (AUDIT_2026-07-12 §форвард-план, AUDIT_2026-07-08) — застарілі, полісі існує.

## G. Доко-дрифт (виправлено цим комітом)

- TRACKER мав застарілі ⬜/🔄 на давно збудоване: S9-01 (2FA), S9-03 (OAuth), S9-04/05 (vault),
  S10-01/02/04/05/07, S11-01/02/03, S13-01/02, SUP-1/2/3 — фліпнуто з посиланнями на міграції.
- ROADMAP:165 «Досі відкрито (r4): agency_members RLS» → уточнено (полісі є, лишився enforce-flip).
