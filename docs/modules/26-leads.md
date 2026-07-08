# LEADS MODULE (CRM-inbound + конфігурований канбан)

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Workspace (work.workflo.space) / API · Залежить від: `packages/db`, `packages/types`, `packages/notifications`, модуль **27-integrations** (джерела), **01-auth** (конверсія в клієнта).
> Статус: **Реалізовано** (CRM-воронка + UTM + activity-timeline + кастомні стадії/пайплайн-редактор ХВІСТ-4) · Створено: 1.06.2026 · Модуль **26**.
> Консолідує розкидане: `ContactForm` (14-landing) + майбутні соц-джерела → єдина воронка лідів.

---

## 0. Навіщо

Потенційний клієнт лишає звернення (сайт, месенджер, соцмережа) → потрапляє в **єдину воронку лідів** агенції → менеджер веде його по **канбан-дошці** → за згодою **конвертується в клієнта** (Company + owner). Кожен лід знає, **звідки прийшов** (атрибуція). Дошка **налаштовується** під процес агенції.

Tenant: усе per-agency (`agencyId`) + `isInternalTeam` + audit. Це **CRM-inbound** частина; зовнішня доставка лідів — у модулі **27-integrations**.

---

## 1. Моделі

> ✅ **РЕАЛІЗОВАНО (ХВІСТ-4, 07.07):** кастомні стадії воронки — модель `LeadStage`
> (`agencyId, name, kind: open|won|lost, position`) + `Lead.stageId` FK. Спрощення проти цього
> дизайну: **одна воронка на агенцію** (без окремого `LeadPipeline` — `LeadStage` привʼязана прямо
> до agencyId), а `Lead.status` лишається coarse-прапорцем результату (`new`=open / `won` / `lost`),
> **синхронізованим зі `stage.kind`** при кожному русі. Дошка = стадії за (kind→position). `won`
> досяжна лише через конвертацію; won/lost захищені від видалення. Owner редагує open-стадії
> (`GET/POST/PATCH/DELETE /workspace/lead-stages`). Дефолти сідяться lazy + міграцією-бекфілом.

```prisma
model Lead {
  id                 String     @id @default(uuid())
  agencyId           String
  // звідки (атрибуція)
  source             LeadSource // website_form | telegram | instagram | tiktok | facebook | whatsapp | email | phone | manual | referral | other
  sourceDetail       Json?      // utm_*, campaign, ad_id, соц-handle, integrationId
  // контакт
  name               String?
  email              String?
  phone              String?
  messengerHandle    String?    // @telegram / ig-handle / wa-number
  message            String?    // текст звернення
  // воронка
  pipelineId         String
  stageId            String
  assignedToId       String?    // executor (AgencyMember)
  // життєвий цикл
  status             LeadStatus @default(open)   // open | won | lost (синхр. зі stage.kind)
  convertedCompanyId String?    @unique          // коли став клієнтом
  lostReason         String?
  rawPayload         Json?      // оригінальний payload інтеграції (audit/дебаг)
  createdAt          DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime   @updatedAt @db.Timestamptz(3)

  @@index([agencyId, stageId])
  @@index([agencyId, source])
  @@index([assignedToId])
  @@map("leads")
}

model LeadPipeline {
  id        String      @id @default(uuid())
  agencyId  String
  name      String
  isDefault Boolean     @default(false)
  stages    LeadStage[]
  @@index([agencyId])
  @@map("lead_pipelines")
}

model LeadStage {
  id         String    @id @default(uuid())
  pipelineId String
  name       String
  position   Int
  color      String?
  kind       StageKind @default(open) // open | won | lost — для конверсії + метрик
  @@index([pipelineId, position])
  @@map("lead_stages")
}

model LeadActivity {
  id        String   @id @default(uuid())
  leadId    String
  actorId   String?  // null = система/інтеграція
  type      String   // note | stage_changed | assigned | contacted | inbound | converted
  content   String?
  metadata  Json?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  @@index([leadId, createdAt])
  @@map("lead_activities")
}

enum LeadSource { website_form telegram instagram tiktok facebook whatsapp email phone manual referral other }
enum LeadStatus { open won lost }
enum StageKind  { open won lost }
```

> `LeadPipeline`/`LeadStage` дзеркалять `OrderStage`-патерн, але **редаговані агенцією** (канбан налаштовується). Дефолт-pipeline сідиться при `provisionAgency()` (новий тенант одразу має воронку).

---

## 2. Канбан-дошка (конфігурована)

- **Дошка** = pipeline; **колонки** = stages (drag-order, колір, `kind`). Картки = `Lead`.
- Drag картки між колонками → `stageId` оновлюється; якщо новий stage `kind=won|lost` → `Lead.status` синхронізується + пише `LeadActivity(stage_changed)`.
- **Налаштування воронки** (`/settings/leads/pipelines`): CRUD pipelines + stages (назва/порядок/колір/kind), кілька воронок (напр. «Продажі» / «Партнерства»), один `isDefault`.
- Фільтри дошки: source, assignee, дата, пошук. Real-time оновлення через наявний **SSE** (як чат) — нові ліди зʼявляються миттєво.

---

## 3. Атрибуція джерела (звідки лід)

Кожен лід обовʼязково має `source` + `sourceDetail`:

- **website_form** → `{ utm_source, utm_medium, utm_campaign, referrer, page }`.
- **telegram/instagram/tiktok/facebook/whatsapp** → `{ handle, channelId, adId?, integrationId }`.
- **manual** → менеджер створив руками.
- **referral** → з реферальної програми (модуль 09).

Звіти (модуль 19): ліди за джерелом, conversion-rate по джерелу, час до конверсії, won/lost. Дашборд «звідки приходять клієнти».

---

## 4. Конверсія лід → клієнт

Кнопка **«Зробити клієнтом»** на картці ліда:

1. `$transaction`: створити `Company` (name з ліда) + `CompanyMember(owner)` (за email ліда — інвайт або існуючий профіль) + `Lead.convertedCompanyId` + `LeadActivity(converted)` + перевести лід у stage `kind=won`.
2. Перевикористовує клієнт-провіжн (звʼязок із майбутнім модулем «Управління клієнтами»).
3. Атрибуція переноситься: `Company` памʼятає, з якого ліда/джерела прийшов (для LTV-аналітики).

---

## 5. API (Workspace, `isInternalTeam` + agency-scoped)

| Метод                   | URL                                           | Опис                                                                        |
| ----------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `GET`                   | `/leads`                                      | Канбан/список (groupBy stage; фільтри source/assignee/pipeline; pagination) |
| `POST`                  | `/leads`                                      | Створити лід (manual)                                                       |
| `GET`                   | `/leads/:id`                                  | Картка ліда + activities                                                    |
| `PATCH`                 | `/leads/:id`                                  | Редагувати / перемістити stage / призначити                                 |
| `POST`                  | `/leads/:id/convert`                          | → Company (+owner)                                                          |
| `POST`                  | `/leads/:id/activities`                       | Нотатка/контакт                                                             |
| `GET/POST/PATCH/DELETE` | `/settings/leads/pipelines[/:id]` + `/stages` | Налаштування воронки                                                        |

**Inbound** (публічний, з модуля 27): `POST` із зовнішнього джерела → `Lead` (source-tagged). Див. 27-integrations §2.

---

## 6. Сповіщення

Новий лід → notify owner + (якщо auto-assign) assignee. Подія матриці `leads.new_lead` (категорія `system`/нова `leads`). SSE для дошки. Опційно — Telegram-сповіщення команді про гарячий лід.

---

## 7. Фази

- **Phase 1 (ядро):** `Lead`+pipeline/stages+activities, канбан, manual + **website_form** + **telegram** джерела, конверсія, нотифікації. (Inbound — через 27 Phase-1.)
- **Phase 2:** мульти-джерела (Meta/TikTok/WhatsApp — через 27 Phase-2), auto-assign-правила, lead-scoring, дублікат-merge, SLA на відповідь.
- **SaaS:** воронка + джерела — per-agency, конфігуруються у white-label-воркспейсі (SAAS_CONFIG.md).

---

## 8. Безпека / tenant

- Усі запити agency-scoped (`agencyId` + `isInternalTeam`); клієнти лідів НЕ бачать.
- Inbound (публічний) — лише через **ApiKey** агенції + rate-limit + спам-захист (27 §2).
- `rawPayload` може містити PII → audit-доступ, не світити клієнту.
- Кожна зміна stage/assign/convert → `LeadActivity` + (критичне) `audit_logs`.

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

Вердикт власника: ✅ ПІДТВЕРДЖЕНО — «можна все додати».

| ID   | Рішення                                                                              | Вплив                | Нюанси власника                     |
| ---- | ------------------------------------------------------------------------------------ | -------------------- | ----------------------------------- |
| 26-А | **Convert → клієнт + перше замовлення/проєкт одним кроком**                          | [бек дрібний]        | —                                   |
| 26-Б | **Follow-up гігієна** («без активності N днів» — підсвітка + нагадування)            | [бек] дрібний        | —                                   |
| 26-В | **Наскрізний UTM-трекінг** (utm\_\* у ліді → звіт джерело→гроші; звʼязка 14-Ж, 11-Д) | [бек] дрібний        | —                                   |
| 26-Д | **Причина програшу** (довідник lost reasons + звіт)                                  | [бек дрібний]        | —                                   |
| 26-Г | **Написати ліду з картки** (email/Telegram з шаблонів)                               | [бек+екран] середній | Прийнято, але ПІЗНІШОЮ фазою модуля |
