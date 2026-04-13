# DOCUMENTS MODULE
> App: Workspace (work.workflo.space) / Portal (app.workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`, `packages/templates`, `packages/storage`
> Оновлено: 12 квітня 2026

---

## Огляд

Модуль генерації PDF-документів: рахунки (invoice), акти виконаних робіт, специфікації, договори та розрахункові листи. Всі документи генеруються через `@react-pdf/renderer` в пакеті `packages/templates`. Зберігаються як PDF-файли через `StorageAdapter`.

---

## Типи документів

| Тип | Enum | Ким генерується | Кому видно |
|---|---|---|---|
| Рахунок | `invoice` | Система/Owner | Клієнт + Команда |
| Акт виконаних робіт | `completion_act` | Owner | Клієнт + Команда |
| Специфікація | `specification` | Owner | Клієнт + Команда |
| Договір | `contract` | Owner | Клієнт + Команда |
| Розрахунковий лист | `payslip` | Owner | Тільки команда |

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

| Статус | Значення |
|---|---|
| `draft` | Чернетка, ще не відправлена клієнту |
| `sent` | Відправлена клієнту (видна в Portal) |
| `signed` | Клієнт підписав (підтвердив) |
| `cancelled` | Анульована |

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
  description: string   // назва роботи/послуги
  quantity: number      // кількість
  unit: string          // 'год' | 'шт' | 'міс' | ...
  unitPrice: number     // ціна за одиницю USD
  total: number         // quantity * unitPrice
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

| Метод | URL | Хто | Опис |
|---|---|---|---|
| `GET` | `/documents` | Workspace | Список всіх документів з фільтрами |
| `GET` | `/orders/:id/documents` | Portal + Workspace | Документи замовлення |
| `POST` | `/orders/:id/documents` | Workspace | Генерувати документ |
| `GET` | `/documents/:id` | Portal + Workspace | Метадані + URL для PDF |
| `PATCH` | `/documents/:id/status` | Workspace | Змінити статус (sent, cancelled) |
| `POST` | `/documents/:id/sign` | Portal | Підтвердити/підписати документ |
| `GET` | `/documents/:id/pdf` | Portal + Workspace | Завантажити PDF |

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
  number: string            // INV-2026-0042
  orderId: string
  companyId: string
  amount: number | null
  amountUah: number | null  // amount * exchangeRate
  exchangeRate: number      // курс на момент генерації
  meta: Record<string, any> // lines для specification, etc.
  fileId: string            // PDF file id
  pdfUrl: string            // URL для завантаження
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

| Подія | Кому | Канал |
|---|---|---|
| Документ відправлено клієнту | Company Owner | Email + Telegram |
| Документ підписано клієнтом | Owner | Telegram |

---

## Локалізація PDF

PDF генерується мовою компанії клієнта (`company.preferredLanguage`):
- `uk` — українська (за замовчуванням)
- `en` — англійська

Переклади для PDF шаблонів зберігаються в `packages/templates/src/i18n/`.

---

## Зв'язки з іншими модулями

| Модуль | Зв'язок |
|---|---|
| **Orders** | Документи прив'язані до замовлення |
| **Files** | PDF зберігається як FileAttachment |
| **Billing** | Invoice → фінансовий запис |
| **Notifications** | Відправка → нотифікація клієнту |
| **Companies** | `preferredLanguage` для PDF мови |
