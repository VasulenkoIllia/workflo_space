# DOCUMENTS MODULE

> App: Workspace (work.workflo.space) / Portal (portal.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/templates`, `packages/storage`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль генерації PDF-документів: рахунки (invoice), акти виконаних робіт, специфікації, договори та розрахункові листи. Всі документи генеруються через `@react-pdf/renderer` в пакеті `packages/templates`. Зберігаються як PDF-файли через `StorageAdapter`.

---

## Типи документів

| Тип                 | Enum             | Ким генерується | Кому видно       |
| ------------------- | ---------------- | --------------- | ---------------- |
| Рахунок             | `invoice`        | Система/Owner   | Клієнт + Команда |
| Акт виконаних робіт | `completion_act` | Owner           | Клієнт + Команда |
| Специфікація        | `specification`  | Owner           | Клієнт + Команда |
| Договір             | `contract`       | Owner           | Клієнт + Команда |
| Розрахунковий лист  | `payslip`        | Owner           | Тільки команда   |

---

## Нумерація документів

### Invoice

Формат: `INV-{YYYY}-{NNNN}` (наприклад `INV-2026-0042`)

- `NNNN` — порядковий номер, починається з `0001` кожного 1 січня
- Зберігається в таблиці `document_counters`:

```prisma
model DocumentCounter {
  year    Int
  type    DocumentType
  counter Int          @default(0)

  @@id([year, type])
}
```

- Видача наступного номера — транзакційно:

```sql
INSERT INTO document_counters (year, type, counter)
VALUES ($year, 'invoice', 1)
ON CONFLICT (year, type)
DO UPDATE SET counter = document_counters.counter + 1
RETURNING counter;
```

- `counter` → `INV-2026-${String(counter).padStart(4, '0')}`

### Акт, специфікація, договір

Аналогічно: `ACT-2026-0001`, `SPEC-2026-0001`, `CTR-2026-0001`, `PAY-2026-0001`

---

## Статуси документів

```
draft → sent → signed → cancelled
```

| Статус      | Значення                             |
| ----------- | ------------------------------------ |
| `draft`     | Чернетка, ще не відправлена клієнту  |
| `sent`      | Відправлена клієнту (видна в Portal) |
| `signed`    | Клієнт підписав (підтвердив)         |
| `cancelled` | Анульована                           |

---

## Бізнес-логіка

### Генерація Invoice

1. Owner/менеджер ініціює генерацію з workspace (вручну або автоматично при `status = done`)
2. Система тягне курс USD/UAH з `exchange_rates` (актуальний на момент генерації)
3. Обчислює `totalAmount`, `advancePaid`, `balanceDue`
4. Передає дані в `packages/templates` → React PDF рендеринг
5. PDF зберігається через `StorageAdapter` → запис у `file_attachments`
6. Запис у таблиці `documents` (зв'язок з `orderId`, `fileId`, `companyId`)
7. Присвоює номер через `DocumentCounter`
8. Статус `draft` → відправляємо коли Owner натискає "Надіслати"

### Автогенерація при done

При переході замовлення в `done`:

- Якщо `balanceDue > 0` → автоматично генерується invoice на `balanceDue`
- Завжди генерується `completion_act`
- Обидва у статусі `draft` (Owner перевіряє перед відправкою)

### "Підписання" в MVP

В MVP немає електронного підпису. "Підписання" = клієнт натискає "Підтверджую та приймаю" в Portal → документ переходить у `signed`. Фіксується `signedAt` та `signedById`.

---

## Специфікація документа (Structure)

Специфікація (`specification`) має структуровані рядки:

```typescript
interface SpecificationLine {
  description: string // назва роботи/послуги
  quantity: number // кількість
  unit: string // 'год' | 'шт' | 'міс' | ...
  unitPrice: number // ціна за одиницю USD
  total: number // quantity * unitPrice
}
```

Зберігається в `Document.meta` як JSON.

---

## packages/templates

```
packages/templates/src/
├── invoice/
│   ├── InvoiceTemplate.tsx    // @react-pdf/renderer компонент
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
  status: DocumentStatus
  number: string // INV-2026-0042
  orderId: string
  companyId: string
  amount: number | null
  amountUah: number | null // amount * exchangeRate
  exchangeRate: number // курс на момент генерації
  meta: Record<string, any> // lines для specification, etc.
  fileId: string // PDF file id
  pdfUrl: string // URL для завантаження
  signedAt: string | null
  signedById: string | null
  createdAt: string
  updatedAt: string
}
```

---

## DB Schema

```prisma
model Document {
  id           String         @id @default(uuid())
  type         DocumentType
  status       DocumentStatus @default(draft)
  number       String         @unique  // INV-2026-0042
  orderId      String?
  companyId    String
  amount       Decimal?       @db.Decimal(10,2)
  amountUah    Decimal?       @db.Decimal(12,2)
  exchangeRate Decimal?       @db.Decimal(10,4)
  meta         Json?          // specification lines, etc.
  fileId       String?        // FK to file_attachments
  signedAt     DateTime?
  signedById   String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  order    Order?          @relation(fields: [orderId], references: [id])
  company  Company         @relation(fields: [companyId], references: [id])
  file     FileAttachment? @relation(fields: [fileId], references: [id])
  signedBy Profile?        @relation(fields: [signedById], references: [id])

  @@index([orderId])
  @@index([companyId])
  @@index([type, status])
}

enum DocumentType {
  invoice
  completion_act
  specification
  contract
  payslip
}

enum DocumentStatus {
  draft
  sent
  signed
  cancelled
}
```

---

## Нотифікації

| Подія                        | Кому          | Канал            |
| ---------------------------- | ------------- | ---------------- |
| Документ відправлено клієнту | Company Owner | Email + Telegram |
| Документ підписано клієнтом  | Owner         | Telegram         |

---

## Локалізація PDF

PDF генерується мовою компанії клієнта (`company.preferredLanguage`):

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

Cron `C02:recurring_billing` (`05-billing.md`) створює `Document(type='invoice')` для кожної recurring subscription. Sequence number generation (для номера інвойсу):

```sql
INSERT INTO documents (type, number, ...)
SELECT 'invoice', 'INV-' || EXTRACT(year FROM NOW()) || '-' || LPAD((MAX(seq)+1)::text, 6, '0'), ...
FROM documents
WHERE type = 'invoice' AND number ~ ('^INV-' || EXTRACT(year FROM NOW()))
```

Атомарність: всередині transaction з `SELECT FOR UPDATE` на спеціальному `document_sequences` row.

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
