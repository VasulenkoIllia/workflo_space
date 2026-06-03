# DOCUMENTS MODULE

> App: Workspace (work.workflo.space) / Portal (portal.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/templates`, `packages/storage`
> Оновлено: 1 червня 2026 (doc-sync)

---

## Огляд

Модуль генерації PDF-документів: рахунки (invoice), акти виконаних робіт, акти звірки, специфікації, договори + credit-note (CRN, з r4). Всі документи генеруються через **HTML → Puppeteer → PDF** у пакеті `packages/templates` (toolkit `DocBrand`/`DocParties`/`DocSigs`/`DocFoot`, реюз HTML/CSS-мокапів з `design/project/documents-screens.jsx` 1:1). Зберігаються як PDF-файли через `StorageAdapter`.

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

### C. Кастомні шаблони документів ✅

- `DocumentTemplate { id, agencyId, type, name, layout Json, isDefault, @@unique([agencyId, type, name]) }` (admin, модуль 20). Поля/тексти/умови понад branding. Резолюція: agency-template → agency-default → платформний хардкод (3 рівні).

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
