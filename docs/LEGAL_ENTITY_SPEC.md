# Міні-спека: Юр-особи агенції (20-Д, передумова S5.6 P-1б)

**Статус: ✅ ЗАТВЕРДЖЕНО власником (2026-06-12)** · передумова `PROJECTS_SPEC.md` (P-3)
Рішення: `OPEN_QUESTIONS_2026-06.md` (Юр-1/2/3).

---

## 1. Навіщо

Агенція виставляє рахунки/акти й укладає договори від конкретної **юр-особи** (ФОП/ТОВ)
зі своїми реквізитами. Проєкт (05-ПРОЕКТИ) посилається на юр-особу: `Project.legalEntityId`.
Зараз у власника одна юр-особа, але укр-реалії = кілька (ФОП-1/ФОП-2/ТОВ) → закладаємо
модель на N з дефолтом 1 (Юр-1: «схема на N, ретрофіт дорогий»).

## 2. Модель (Prisma-ескіз)

```prisma
/// Юр-особа агенції (20-Д). Реквізити для документів і договорів. N на агенцію, ≥1 дефолтна.
model LegalEntity {
  id        String  @id @default(uuid())
  agencyId  String
  agency    Agency  @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  name        String   // внутрішня назва («ФОП Іваненко», «ТОВ Workflo»)
  legalType   String   // 'fop' | 'tov' | 'individual' | 'foreign' (вільний — як Project.type, П8)
  legalName   String   // повна юр-назва для документів
  taxId       String?  // ЄДРПОУ / ІПН / РНОКПП
  vatPayer    Boolean  @default(false) // платник ПДВ (звʼязок 05-Ж VAT-поля)
  vatId       String?  // ІПН платника ПДВ
  legalAddress String?
  // банк/оплата
  bankName    String?
  iban        String?
  // підписант
  signerName  String?  // ПІБ, хто підписує
  signerTitle String?  // посада («директор», «ФОП»)
  // бренд документів (може відрізнятись від agency-branding)
  stampUrl    String?  // печатка/підпис (storage key)

  isDefault   Boolean  @default(false) // дефолтна юр-особа агенції (Юр-3 каскад)
  isComplete  Boolean  @default(false) // обчислюється: всі обовʼязкові поля заповнені (Юр-2 gate)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)

  projects  Project[]
  documents Document[] // Document + legalEntityId? (від кого виставлено)

  @@unique([agencyId, name])
  @@index([agencyId])
  @@index([agencyId, isDefault])
  @@map("legal_entities")
}
```

Зміни наявних: `Project.legalEntity LegalEntity?` (FK на `legalEntityId` — уже в PROJECTS_SPEC);
`Document.legalEntityId String?` (від якої юр-особи виставлено); `Agency` — back-relation.

## 3. Правила (рішення власника)

- **Юр-1 — кілька з дефолтом 1:** `provisionAgency()` створює одну `LegalEntity{isDefault:true}`
  з даних агенції. UI керування кількома — мінімальний зараз (CRUD), повноцінний — за потреби.
- **Юр-2 — gate неповноти:** `isComplete=false` (бракує обовʼязкових: `legalName` + `taxId` +
  `iban` + `signerName` — мінімум для документа) → **генерація рахунків/актів ЗАБЛОКОВАНА**
  (як договір-гейт П3), але робота і активація проєкту НЕ блокуються. Ворнінг у UI.
- **Юр-3 — каскад вибору:** `Project.legalEntityId` → якщо null, береться `LegalEntity{isDefault}`
  агенції. На проєкті можна явно перевизначити.
- **Обовʼязкові поля для документа** (формують `isComplete`) — редаговані в налаштуваннях
  агенції per-`legalType` (UA-ФОП vs ТОВ vs foreign — різні набори; звʼязок 06-Е UA/EU формати).

## 4. Вплив на план

- **S5.6 P-1б** (передумова, до/разом із P-3): модель + `provisionAgency()` дефолтна юр-особа +
  CRUD у Workspace-адмінці (20) + `isComplete`-обчислення.
- **P-3** (юр-онбординг): реквізити клієнта + email для документів — окремо (06-Б), юр-особа
  агенції — тут.
- **S6 (документи):** генерація від `Project.legalEntity` (резолв каскадом), номер per-agency
  (наявний `DocumentCounter` — розглянути per-legalEntity нумерацію, якщо вимагає бухгалтерія —
  ⚠️ уточнити при S6, не зараз).

## 5. Для ТЗ дизайнеру

Розділ «Юр-особи агенції» в Workspace-адмінці (список + форма реквізитів + дефолт-перемикач +
індикатор повноти `isComplete`); селектор юр-особи на формі проєкту (з дефолтом).
