# DOCUMENTS MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Workspace (work.workflo.space) / Portal (portal.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/templates`, `packages/storage`
> Оновлено: 1 червня 2026 (doc-sync)

---

> 🔄 **design-v2 (2026-06-20):** доставлено **documents-eu** — 8 екранів EU/юр-комплекту (інвойс, credit-note, SoW/SoA/Agreement/Act, публічна pay-сторінка): [`workspace-documents-eu.jsx`](../../design-v2/project/workspace-documents-eu.jsx). Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).
>
> ✅ **S6-D1/D3 (2026-06-24):** route генерації/видачі **є** — `POST/GET /orders/:orderId/documents` (`apps/api/src/routes/documents/`): per-agency race-safe нумерація (`DocumentCounter` `INSERT…ON CONFLICT…RETURNING`, формат `INV-2026-000001`) + таб «Документи» (workspace генерує рахунок/акт/спец, портал — read-only; клік на номер → перегляд). Звірено E2E на реальній PG (smoke).
>
> ✅ **S6-D2 (2026-06-24):** PDF-движок **реалізовано** — `packages/templates`: `renderDocumentHtml()` (брендований HTML, `wfd-*`-мова, кирилиця) + `htmlToPdf()` (`puppeteer-core` → system Chromium; `Dockerfile.api` ставить `chromium`+шрифти, `PUPPETEER_EXECUTABLE_PATH`). `GET /orders/:id/documents/:docId/pdf` віддає PDF; **без Chromium (local/CI) — graceful HTML-fallback** (той самий HTML, друк-у-PDF). Реальний рендер звірено (76 КБ `%PDF-`).
>
> ✅ **S6-BE-2 (2026-06-25):** **надсилання клієнту** — `POST /orders/:id/documents/:docId/send` (team) → status `sent` + `sentAt` → outbox `document.sent` → нотифікація клієнту (рахунок → `billing.invoice_sent` email; інші типи → in_app). Звірено наживо. ⚠️ **Лишається:** email-вкладення PDF (зараз лінк) · stored-snapshot (`storedAs`, рендер on-demand) · автоген акту при `done` · credit-note · решта EU-шаблонів · UI-кнопка «Надіслати» (фронт-фаза).

## Огляд

Модуль генерації PDF-документів: рахунки (invoice), акти виконаних робіт, акти звірки, специфікації, договори + credit-note (CRN, з r4). Всі документи генеруються через **HTML → Puppeteer → PDF** у пакеті `packages/templates` (toolkit `DocBrand`/`DocParties`/`DocSigs`/`DocFoot`, реюз HTML/CSS-мокапів з `design-v2/project/documents-screens.jsx` + новий `workspace-documents-eu.jsx` 1:1). Зберігаються як PDF-файли через `StorageAdapter`.

> Движок зафіксовано 2026-05-29 (`DESIGN_SYSTEM.md §5.5 + §8 row 4`). Старіші згадки `@react-pdf/renderer` нижче — застаріли; код-приклади треба переписати під Puppeteer (TODO).

---

## Типи документів

| Тип                 | Enum                 | Ким генерується | Кому видно       |
| ------------------- | -------------------- | --------------- | ---------------- |
| Рахунок             | `invoice`            | Система/Owner   | Клієнт + Команда |
| Аванс-рахунок       | `advance_invoice`    | Система/Owner   | Клієнт + Команда |
| Акт виконаних робіт | `completion_act`     | Owner           | Клієнт + Команда |
| Специфікація        | `specification`      | Owner           | Клієнт + Команда |
| Договір             | `contract`           | Owner           | Клієнт + Команда |
| Акт звірки          | `reconciliation_act` | Система/Owner   | Клієнт + Команда |

> Реальний enum `DocumentType` (схема): `invoice · advance_invoice · completion_act · specification · contract · reconciliation_act` (+ план: `credit_note`). ⚠️ `payslip` — **не** тип документа (ЗП — модулі 22/12, не `Document`).

---

## Нумерація документів

### Invoice

Формат: `INV-{YYYY}-{NNNNNN}` (6-значний, наприклад `INV-2026-000042`).

**Канонічно (Аудит-фіналізація A):** лічильник **per-agency** — `DocumentCounter` з `@@id([agencyId, type, year])` + поле `count` (інакше дві агенції колізують на `INV-2026-000001`). Race-safe видача — `INSERT…ON CONFLICT DO UPDATE…RETURNING` (єдиний алгоритм; конкуруючий `MAX(seq)+1` self-join — видалити).

```sql
INSERT INTO document_counters (agency_id, type, year, count)
VALUES ($agencyId, 'invoice', $year, 1)
ON CONFLICT (agency_id, type, year)
DO UPDATE SET count = document_counters.count + 1
RETURNING count;
```

`count` → `INV-2026-${String(count).padStart(6, '0')}`.

### Акт, специфікація, договір, звірка

Аналогічно per-agency: `ACT-2026-000001`, `SPEC-2026-000001`, `CTR-2026-000001`, `REC-2026-000001`.

---

## Статуси документів

```
draft → generated → sent  (+ signed через e-signature; supersede замість редагування)
```

| Статус      | Значення                                         |
| ----------- | ------------------------------------------------ |
| `draft`     | Чернетка (preview, номер ще не зафіксовано)      |
| `generated` | PDF згенеровано + номер зафіксовано (immutable)  |
| `sent`      | Відправлено клієнту (видно в Portal)             |
| `signed`    | Підписано (e-signature, Аудит-фіналізація B; S6) |

> Реальний enum `DocumentStatus` (схема): `draft · generated · sent`. `signed` додає e-signature (фаза B). **Без `cancelled`** — анулювання через `supersededById` (нова версія) + immutability-lock, не статус.

---

## Бізнес-логіка

### Генерація Invoice

1. Owner/менеджер ініціює генерацію з workspace (вручну або автоматично при `done`).
2. Курс USD/UAH — рядок per-currency з `exchange_rates` (актуальний на момент) → `rateUsed`.
3. Обчислює `amountNative`/`amountUsd` (+ tax-поля), `balanceDue`.
4. Дані → `packages/templates/src/pdf/` → React-PDF рендер (з `pdf_branding`).
5. PDF → `StorageAdapter` (`Document.storedAs`, не окремий `fileId`).
6. Запис `documents` (`orderId?`, `companyId`, `createdById`, `agencyId`).
7. Номер — per-agency `DocumentCounter` (фіксується при `draft→generated`).
8. Флоу `draft → (preview) → approve → sent` (Аудит-фіналізація E).

### Автогенерація при done

При переході замовлення в `done`:

- Якщо `balanceDue > 0` → автоматично генерується invoice на `balanceDue`
- Завжди генерується `completion_act`
- Обидва у статусі `draft` (Owner перевіряє перед відправкою)

### "Підписання" в MVP

В MVP немає електронного підпису. "Підписання" = клієнт натискає "Підтверджую та приймаю" в Portal → документ переходить у `signed`. Фіксується `signedAt` та `signedById`.

---

## Специфікація документа (Structure)

Специфікація (`specification`) має структуровані рядки `DocumentLine` (окрема таблиця, **не** `Document.meta` JSON — Аудит-фіналізація A):

```typescript
interface DocumentLine {
  description: string // назва роботи/послуги
  quantity: number // кількість
  unit: string // 'год' | 'шт' | 'міс' | ...
  unitPrice: number // ціна за одиницю USD
  total: number // quantity * unitPrice
}
```

> ⚠️ `Document.meta` JSON для line-items — застаріло; канон — таблиця `DocumentLine`.

---

## packages/templates

```
packages/templates/src/
├── invoice/
│   ├── InvoiceTemplate.tsx    // React → HTML → Puppeteer → PDF
│   └── InvoiceData.ts         // TypeScript DTO для шаблону
├── completion-act/
│   ├── ActTemplate.tsx
│   └── ActData.ts
├── specification/
│   ├── SpecTemplate.tsx
│   └── SpecData.ts
├── contract/
│   └── ...
├── payslip/
│   └── ...
└── index.ts                   // export generatePdf(type, data): Promise<Buffer>
```

### `generatePdf` function

```typescript
export async function generatePdf(
  type: DocumentType,
  data: InvoiceData | ActData | SpecData | ContractData | PayslipData
): Promise<Buffer> {
  const Component = TEMPLATES[type]
  const stream = await renderToStream(<Component data={data} />)
  return streamToBuffer(stream)
}
```

---

## API Endpoints

| Метод   | URL                     | Хто                | Опис                               |
| ------- | ----------------------- | ------------------ | ---------------------------------- |
| `GET`   | `/documents`            | Workspace          | Список всіх документів з фільтрами |
| `GET`   | `/orders/:id/documents` | Portal + Workspace | Документи замовлення               |
| `POST`  | `/orders/:id/documents` | Workspace          | Генерувати документ                |
| `GET`   | `/documents/:id`        | Portal + Workspace | Метадані + URL для PDF             |
| `PATCH` | `/documents/:id/status` | Workspace          | Змінити статус (sent, cancelled)   |
| `POST`  | `/documents/:id/sign`   | Portal             | Підтвердити/підписати документ     |
| `GET`   | `/documents/:id/pdf`    | Portal + Workspace | Завантажити PDF                    |

---

## DTO

### `POST /orders/:id/documents`

```typescript
{
  type: 'invoice' | 'completion_act' | 'specification' | 'contract' | 'payslip'
  // Для invoice:
  amount?: number           // якщо не вказано — рахуємо balanceDue
  description?: string
  // Для specification:
  lines?: SpecificationLine[]
  // Для contract:
  templateId?: string       // з бібліотеки шаблонів (Phase 2)
  customContent?: string    // Markdown (MVP)
}
```

### Document Response

```typescript
{
  id: string
  type: DocumentType
  status: DocumentStatus       // draft | generated | sent (+ signed)
  number: string               // INV-2026-000042
  orderId: string | null
  companyId: string
  amountNative: number | null  // не `amount`
  amountUsd: number | null     // не `amountUah`
  currency: string
  rateUsed: number | null      // не `exchangeRate`
  taxRatePct: number | null
  taxAmount: number | null
  lines: DocumentLine[]        // окрема таблиця, не `meta`
  signedAt: string | null
  signedById: string | null
  supersededById: string | null
  createdAt: string
  updatedAt: string
}
```

---

## DB Schema

> **Канонічна модель — `Document` + `DocumentCounter` у `packages/db/prisma/schema.prisma`** (стара модель нижче — видалена з doc-sync).
> Ключове: `agencyId`; суми `amountNative`/`amountUsd`/`currency`/`rateUsed` (+ `taxRatePct`/`taxAmount`) — НЕ `amount`/`amountUah`/`exchangeRate`/`meta`; PDF як `storedAs` (не `fileId`); `createdById`/`executorId`; `sentAt`/`generatedAt`; `supersededById` (immutability); `@@unique([companyId, type, number])`. Lines — таблиця `DocumentLine`. `DocumentCounter` — `@@id([agencyId, type, year])` + `count`.
> enum `DocumentType`: `invoice·advance_invoice·completion_act·specification·contract·reconciliation_act` (+план `credit_note`); `DocumentStatus`: `draft·generated·sent` (+`signed`). Нові моделі (DocumentTemplate/DocumentLine/CreditNote) + повний reconcile — «## Аудит-фіналізація» нижче.

---

## Нотифікації

| Подія                        | Кому          | Канал            |
| ---------------------------- | ------------- | ---------------- |
| Документ відправлено клієнту | Company Owner | Email + Telegram |
| Документ підписано клієнтом  | Owner         | Telegram         |

---

## Локалізація PDF

PDF генерується мовою компанії клієнта (`Company.language`, enum uk/en):

- `uk` — українська (за замовчуванням)
- `en` — англійська

Переклади для PDF шаблонів зберігаються в `packages/templates/src/i18n/`.

---

## Зв'язки з іншими модулями

| Модуль            | Зв'язок                            |
| ----------------- | ---------------------------------- |
| **Orders**        | Документи прив'язані до замовлення |
| **Files**         | PDF зберігається як FileAttachment |
| **Billing**       | Invoice → фінансовий запис         |
| **Notifications** | Відправка → нотифікація клієнту    |
| **Companies**     | `preferredLanguage` для PDF мови   |

---

## S1 alignment update (17 квітня 2026 → 27 травня 2026)

### `reconciliation_act` document type

В S1-03 migration додано `reconciliation_act` до `DocumentType` enum.

Спосіб генерації + UI — див. `05-billing.md → секція "Acts of reconciliation"`.

### Integration з auto-invoice

Cron `C02:recurring_billing` (`05-billing.md`) створює `Document(type='invoice')` для кожної recurring subscription. Номер інвойсу — через **канонічний per-agency `DocumentCounter`** (`@@id([agencyId, type, year])` + `count`): `INSERT…ON CONFLICT DO UPDATE…RETURNING count` (race-safe, без `MAX(seq)+1` self-join і без `document_sequences`). Деталі — секція «Канонічно» вище.

### Specification flow (autogeneration)

Див. `02-orders.md → секція "Specification flow (auto-generated)"`.

При transition order у `review`, система creates draft Specification з усіх `time_logs.description` коментарів executor'а. Owner редагує + затверджує.

### PDF branding

Всі документи (invoice, completion_act, specification, reconciliation_act) використовують `pdf_branding` singleton (`20-admin-settings.md → секція 3`):

- Logo, primary color, font family, footer.
- Render via React-PDF (`packages/templates/src/pdf/`).

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

> Авторитетна секція. Stale status/`amount`/numbering вище → видалити в doc-sync.

### A. Обов'язкові reconcile

- **`agencyId` на `Document` + `DocumentCounter`** → нумерація **per-agency** (`@@id([agencyId, type, year])`), інакше дві агенції колізують на `INV-2026-0001`.
- **Один race-safe алгоритм**: counter-таблиця `INSERT…ON CONFLICT DO UPDATE…RETURNING` (видалити конкуруючий `MAX(seq)+1` self-join). `DocumentCounter.count` (узгодити назву).
- **Status enum** під реальність + (з підписом, нижче) `signed`/`cancelled`; `amountNative/amountUsd/currency/rateUsed` + tax-поля + line-items (не `meta` JSON).
- **Immutability**: після `sent`/`signed` PDF+суми незмінні; зміна = `supersededById` (нова версія) + lock. Credit-note як окремий `DocumentType`.
- **Access-check** на `GET /documents/:id/pdf` (tenant + company-owner; не публічний guessable шлях) — signed-URL.
- `PaymentAllocation.chargeType` дискримінатор (ServiceCharge|Document).

### B. E-signature ✅ (= арх. тема #7)

- `Document` додає `signedAt`, `signedById`, `signatureType('click'|'diia'|'kep')`, `signatureAudit Json` (IP/UA/timestamp/hash).
- **Фаза 1 — простий клік-підпис**: клієнт у portal «Підписати» → запис signedAt + audit + хеш PDF (tamper-evidence). Статус `sent→signed`.
- **Фаза 2 — Дія.Підпис / КЕП** (юридично значущий): інтеграція з Дія.Підпис API; адаптер `SignatureProvider` (click | diia | kep), вибір per-agency/per-document-type.
- Event `documents.signed` → notify owner. Підписаний PDF immutable.

> **UPDATE 06.07.2026 — фаза 1 реалізована (рішення власника: клік + ПІБ, скоуп договір+акт,
> гейт-тумблер агенції).** Відхилення від чернетки вище — простіша модель полів:
>
> - Статус `accepted` (не `signed` — чесна назва для не-КЕП прийняття). `Document` +=
>   `acceptedAt / acceptedById / acceptedByName / acceptedIp` (typed signature: ПІБ, час,
>   IP, акаунт; повний слід і в audit_logs). Без hash/signatureType — це фаза 2 (КЕП/Дія).
> - `POST /portal/documents/:docId/accept {fullName}` — клієнт-учасник компанії; лише
>   типи `contract`/`completion_act`; лише зі статусу `sent` (атомарний claim, replay 409).
>   Event `documents.accepted` → in-app власникам (email-шаблону нема свідомо).
> - **Договір-гейт:** `Agency.requireSignedContract` (owner-тумблер «Воркфлоу · договір»
>   у /settings, `GET/PATCH /workspace/agency/workflow-settings`, вимкнено за
>   замовчуванням) → перехід замовлення `→ in_progress` блокується 409, поки компанія
>   не має ПРИЙНЯТОГО договору. Рамкова семантика: будь-який accepted-договір КОМПАНІЇ
>   (не per-order); внутрішніх замовлень без компанії не стосується.
> - UI: портал «Документи»-таб — кнопка «Прийняти» на надісланих договорах/актах →
>   модалка з ПІБ; після — бейдж «прийнято» + «✓ ПІБ» в обох апках.

> **UPDATE 06.07.2026 (3) — 06-SEND: вкладення + портальні «Документи».**
>
> - **Email-вкладення PDF** (закриває хвіст S6-BE-2): notify-пайплайн отримав наскрізні
>   attachments (EmailPayload → dispatchEmail → NotifyInput); збірка рендера винесена в
>   `services/documentRender.ts` (роути документів + outbox-воркер реюзають одне).
>   `document.sent` для рахунків тепер кладе PDF документа у лист `billing.invoice_sent`
>   (без Chromium — HTML-вкладення; збій рендера → лист іде без вкладення, доставку не валимо).
>   Інші типи документів email не мають (in_app) — вкладення не рендериться дарма.
> - **Портал `/documents`** (був Placeholder): `GET /portal/documents` — усі
>   НАДІСЛАНІ/ПРИЙНЯТІ документи компаній клієнта одним списком (рахунки/акти/договори
>   вкл. зовнішні/специфікації/місячні звіти); чернетки й «сформовані» не течуть.
>   Відкриття: order-PDF / generic-PDF (monthly) / файл чи лінк зовнішнього договору;
>   договір/акт можна прийняти прямо зі списку (та сама модалка ПІБ).
> - Payment-terms: перевірено — `paymentTermsDays` вже редагується в «Оплата»
>   (/settings) і живить dueDate рахунка в PDF та листі; нового нічого не треба.

> **UPDATE 06.07.2026 (пізніше) — 06-ДОГОВІР-2: зовнішній договір + узгодження гейтів +
> «Підстава» в PDF** (рішення власника, 4 пункти вікторини):
>
> - **Зовнішній договір** (підписаний поза системою): `Document` += `signedExternally /
contractDate / externalUrl` (+ файл у нарешті задіяному `storedAs`).
>   `POST /workspace/companies/:companyId/contracts/external` (команда крім manager;
>   JSON або multipart з PDF): власний номер + дата підписання + підписант + файл АБО
>   посилання → створюється одразу `accepted`. Дубль номера по компанії → 409.
>   `GET /documents/:docId/file` віддає збережений файл (ASCII-safe Content-Disposition +
>   RFC 5987 filename\* — зовнішні номери містять «№»). UI: клієнт-360 «Документи» —
>   кнопка «+ Зовнішній договір» (модалка), бейдж «зовнішній», відкриття файла/лінка.
> - **Каскад гейтів (проект → агенція):** effective = `project.contractRequired ??
agency.requireSignedContract`. Проект явно «без договору» → старт-гейт його
>   замовлень не чіпає (агенцію навіть не питаємо); проект «з договором» → гейт діє
>   навіть без агентського тумблера. Разові замовлення — за тумблером агенції.
> - **П3 посилено:** білінг-гейт проєкту тепер вимагає ПРИЙНЯТИЙ договір
>   (привʼязана чернетка більше не відкриває генерацію рахунків/актів; cron тримає
>   такі проєкти в held, цикли наздоганяють після прийняття).
> - **«Підстава» в PDF:** рахунок/акт друкують рядок «договір: Договір № … від …» —
>   резолюція: привʼязаний до проєкту accepted-договір → інакше останній
>   accepted-договір компанії → нема жодного — рядок не друкується.

### C. Кастомні шаблони документів ✅

- `DocumentTemplate { id, agencyId, type, name, layout Json, isDefault, @@unique([agencyId, type, name]) }` (admin, модуль 20). Поля/тексти/умови понад branding. Резолюція: agency-template → agency-default → платформний хардкод (3 рівні).

> **UPDATE 06.07.2026 — 06-А реалізовано (рішення власника: секції з {{змінними}}, всі
> типи, лого + акцент).** Спрощення проти чернетки: `DocumentTemplate {agencyId, type,
body Json, @@unique([agencyId, type])}` — ОДИН шаблон на тип (без name-варіантів),
> 2-рівнева резолюція agency → системний хардкод. body: contract → `{sections:[{h,p[]}]}`;
> інші типи → `{note?, purpose? (лише рахунки)}`. Підстановки: {{client}} {{client_legal}}
> {{agency}} {{order}} {{project}} {{amount}} {{number}} {{date}} {{contract}} — невідомий
> токен лишається видимим у PDF. Роути (owner): `GET/PUT/DELETE
/workspace/agency/document-templates(/:type)` — GET віддає overrides + довідку змінних +
> типовий договір, префілений {{токенами}} (стартова точка редактора).
> **PDF-брендинг** — поля на Agency (`pdfLogoKey` у storage + `pdfAccentColor` hex), НЕ
> singleton-таблиця: `GET/PUT /workspace/agency/pdf-branding` (multipart лого PNG/JPEG
> ≤512КБ або JSON accent/removeLogo) + `GET …/logo` для прев'ю. Рендер: лого data-URI в
> шапці всіх PDF, акцент підміняє системний колір у CSS. UI: дві картки в /settings
> («Шаблони документів» — редактор секцій/приміток + «PDF-брендинг»).

### D. Групові операції ✅

- `POST /documents/bulk-generate { type, companyIds[], period }`, `POST /documents/bulk-send { documentIds[] }`, `GET /documents/export.zip?ids=`. Через outbox (черга, тема #2) — щоб масова генерація PDF не блокувала. Корисно для місячного закриття (акти звірки всім).

### E. Прев'ю перед надсиланням ✅

- Флоу `draft → (preview PDF) → approve → sent`. `GET /documents/:id/preview` рендерить PDF без фіксації номера/відправки. Owner редагує draft, бачить фінал, тоді approve+send. Запобігає помилковим рахункам.

### Schema-зміни (foundation-міграція)

```
Document: + agencyId, signedAt, signedById, signatureType, signatureAudit, supersededById,
            amountNative, amountUsd, currency, rateUsed, taxRatePct, taxAmount
DocumentCounter: + agencyId (composite PK)
New: DocumentTemplate, DocumentLine(line-items), CreditNote(type)
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                                               | Вплив                | Нюанси власника                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 06-А | **Шаблони договорів зі змінними** + привʼязка до проєкту (05-ПРОЕКТИ)                                 | [бек+екран]          | + закласти **кастомізацію шаблонів** під SaaS-фазу (тенант редагує свої шаблони)                                                                                                                                                                                                                                                               |
| 06-Б | **Реквізити компанії клієнта + юр-онбординг**                                                         | [бек+екран]          | Розширено власником: у Portal — окрема опція «створити компанію»; якщо створив — заповнення ВСІХ юр-даних для документів + **email для відправки документів** + юр-поля. Агенція **вивантажує клієнту договори** які укладає (upload готових підписаних). **Клієнт САМ формує собі документи за потреби** (self-service: акт звірки тощо)      |
| 06-В | **Автоакти/автодокументи по білінг-циклу**                                                            | [бек]                | Розширено: на проєкті — тип білінгу (абонплата з авансом / погодинка / …) + **період виставлення: кожного N-числа місяця АБО щотижня (напр. щопонеділка авто-закриття зданих задач + відправка документів) АБО вручну** («здав проект — закрив руками — сформував документи»). Все в налаштуваннях проєкту. Доповнює 05-ПРОЕКТИ білінг-циклами |
| 06-Г | **Трекінг доставки документів** (email доставлено/відкрито) + **відправка документів у Telegram-бот** | [бек] + статус-рядок | Telegram як другий канал доставки документів (звʼязка з модулем 15)                                                                                                                                                                                                                                                                            |
| 06-Д | **Публічна сторінка рахунку** (лінк без логіна; + кнопка оплати коли 05-А увімкнеться)                | [бек+екран]          |                                                                                                                                                                                                                                                                                                                                                |
| 06-Е | **Двомовність ВСЬОГО** + два комплекти документів                                                     | [шаблони+i18n]       | «Все що ми робимо — на 2-х мовах» (підтверджує глобальний i18n Block 7b). Документи: **окремий вигляд для українського ринку і окремий для європейського** (не лише переклад — різні формати)                                                                                                                                                  |

**Для ТЗ дизайнеру:** юр-онбординг компанії в Portal (форма реквізитів, email для документів) (Б); розділ «Документи» з self-service генерацією для клієнта (Б); налаштування білінг-циклу проєкту (В); статуси доставки документа + канал Telegram (Г); публічна сторінка рахунку (Д); **два візуальні комплекти документів UA/EU** (Е — окреме дизайн-завдання!).
