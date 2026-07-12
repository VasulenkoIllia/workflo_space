# CALENDAR / MEETINGS MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Workspace + Portal (clients see meetings they're invited to)
> Статус: **MVP реалізовано (CAL-MVP, 2026-07-07)** — модель CalendarEvent/CalendarAttendee, роути
> `/calendar/*`, місячна сітка, respond/RSVP, reminder-cron. Booking-типи/відпустки — post-MVP. Див. UPDATE нижче.
> Залежить від: `07-notifications` (з розширенням recipient), `01-auth`, `23-leave`
> Оновлено: 8 липня 2026 (drift-звірка r5)

---

> 🔄 **design-v2 (2026-06-20):** доставлено **calendar-plus** — налаштування календаря, типи бронювань (video/phone/inperson + провайдери), відпустки: [`workspace-calendar-plus.jsx`](../../design-v2/project/workspace-calendar-plus.jsx). ✅ **бекенд MVP збудовано (CAL-MVP 2026-07-07):** зустрічі/RSVP/reminder-cron є; booking-типи (video/phone/inperson) + відпустки (модуль 23) — post-MVP. Матриця — [`DESIGN_SYSTEM.md §5.13`](../DESIGN_SYSTEM.md).

## Огляд

Календар для планування **зустрічей**: команда↔команда і команда↔клієнт. Запрошені отримують нотифікацію, підтверджують/відхиляють, усе видно в одному календарному view (зустрічі + дедлайни замовлень + відпустки).

**Чому це велике (L)** — не через саму модель (вона M), а через **дві архітектурні проблеми**, які треба вирішити до старту (див. нижче).

---

## Модель даних

```prisma
enum CalendarEventType {
  internal_meeting   // команда↔команда
  client_meeting     // команда↔клієнт
  leave              // підтягується з leave_requests (read-only проєкція)
  order_deadline     // підтягується з orders.deadline (read-only проєкція)
}

enum AttendeeResponse {
  pending
  accepted
  declined
}

model CalendarEvent {
  id          String            @id @default(uuid())
  title       String
  description String?
  type        CalendarEventType
  startsAt    DateTime          @db.Timestamptz(3)
  endsAt      DateTime          @db.Timestamptz(3)
  timezone    String            @default("Europe/Kyiv")  // IANA tz для коректного рендеру
  location    String?           // фіз. адреса
  meetingUrl  String?           // Zoom/Meet/Telegram-call
  companyId   String?           // для client_meeting
  company     Company?          @relation(fields: [companyId], references: [id])
  createdById String
  createdBy   Profile           @relation("EventCreatedBy", fields: [createdById], references: [id])
  cancelledAt DateTime?         @db.Timestamptz(3)
  createdAt   DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime          @updatedAt @db.Timestamptz(3)

  attendees   CalendarAttendee[]

  @@index([startsAt])
  @@index([companyId, startsAt])
  @@index([createdById])
  @@map("calendar_events")
}

model CalendarAttendee {
  id             String           @id @default(uuid())
  eventId        String
  event          CalendarEvent    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  // Polymorphic recipient — EITHER an internal profile OR a raw email guest:
  profileId      String?
  profile        Profile?         @relation(fields: [profileId], references: [id])
  guestEmail     String?          // зовнішній учасник без акаунту
  guestName      String?
  response       AttendeeResponse @default(pending)
  respondedAt    DateTime?        @db.Timestamptz(3)

  @@unique([eventId, profileId])
  @@index([profileId, eventId])
  @@map("calendar_attendees")
}
```

---

## ⚠️ Два рішення, які треба ухвалити ДО старту

### 1. Polymorphic recipient (архітектурна рекомендація D2)

Запрошені — мікс: internal executors (Profile), клієнти (Profile), і **зовнішні email-гості без акаунту**. Поточний `notify(deps, { profileId, ... })` працює лише з `profileId` → зовнішній гість через матрицю не пройде.

**Рішення:** додати `notify`-overload, що приймає `Recipient` напряму (тип `Recipient` ВЖЕ існує у `dispatch.ts` — лише оркестратор profileId-locked). Це маленька зміна (~1 день), яку варто зробити **до** календаря (і вона також прибере дубль у `inviteEmail.ts`, який зараз шле пошту в обхід матриці). Див. BACKLOG «do-now D2».

### 2. Timezone (архітектурний ризик R5)

Зараз усе Timestamptz-stored, Kyiv-rendered (cron-и, NBU). Зустрічі між українською командою і клієнтами в інших TZ ламають це припущення. Тому `CalendarEvent.timezone` (IANA) зберігаємо per-event, рендеримо у TZ глядача. Вирішити на старті — дешево; ретрофіт — дорого.

---

## Endpoints

| Method  | Path                               | Auth                       | Опис                                                |
| ------- | ---------------------------------- | -------------------------- | --------------------------------------------------- |
| `POST`  | `/calendar/events`                 | executor / owner           | Створити зустріч + запросити                        |
| `GET`   | `/calendar/events?from=&to=&type=` | any (свої + де запрошений) | Список для view (+`leaves` для team-ролей — S13-05) |
| `PATCH` | `/calendar/events/:id`             | creator / owner            | Редагувати (час, місце)                             |
| `POST`  | `/calendar/events/:id/cancel`      | creator / owner            | Скасувати (+notify усім)                            |
| `POST`  | `/calendar/events/:id/respond`     | invitee                    | accept / decline                                    |
| `GET`   | `/calendar/view?from=&to=`         | any                        | Агрегований: events + deadlines + leave             |

`can()`: `calendar.event.create/update/cancel/invite`. Політика: owner може зустріч з клієнтом; чи може executor самостійно — рішення (рекомендую так, з notify owner'у).

---

## Notifications (reuse + D2 recipient)

Нові events: `calendar.invited`, `calendar.updated`, `calendar.cancelled`, `calendar.reminder`.

- Для Profile-учасників — через матрицю.
- Для зовнішніх email-гостей — через `notifyRecipient()` (D2).
- **Reminder** — cron (модель як `C03 dueDateReminder`): за 1 год / 1 день до `startsAt`.

---

## Відпустки у календарі ✅ ЗБУДОВАНО (S13-05, 2026-07-13)

**Read-side merge без dual-write** — `GET /calendar/events` при заданих `from`+`to` додає до відповіді
поле `leaves`: `approved`-відсутності команди, чиє вікно перетинає запит (`startDate<=to AND endDate>=from`),
`{id, type, startDate, endDate, days, profile:{id,name}}`, cap 200. **Видимі лише team-ролям**
(перевірка `user.agencyMemberships` містить активну агенцію) — портальний клієнт `leaves` не отримує
(хто з команди відсутній — внутрішня інформація). Без `from`/`to` → `leaves:[]`. Dual-write у
`CalendarEvent` свідомо не робимо: `reject`/`cancel` відсутності не потребували б синку, а source-of-truth
лишається `leave_requests` (модуль 23). Workspace місячна сітка розгортає діапазон у чіпи по днях
(read-only, іконка+ПІБ, стеля 62 дні/заявка).

## Aggregated calendar view

`GET /calendar/view` зливає 3-4 джерела у read-model:

- `calendar_events` (зустрічі),
- `orders.deadline` (дедлайни як read-only events),
- `leave_requests` (approved — як «зайнятість»),
- опційно `service_charges.dueDate` (платіжні дати).

Це read-only проєкція — окремих рядків у `calendar_events` для дедлайнів/відпусток НЕ створюємо (уникаємо дублю стану).

---

## Фази

- **Фаза 1:** одиничні зустрічі + invitees (Profile) + notifications + view (events+deadlines). Без recurrence, без зовнішніх гостей.
- **Фаза 2:** зовнішні email-гості (потребує D2), recurring meetings (recurrence rules — складність як у recurring billing), ICS-експорт.

---

## Acceptance (Фаза 1)

- [ ] Створити зустріч, запросити учасників (Profile).
- [ ] Учасники отримують notification + accept/decline.
- [ ] Reminder cron перед зустріччю.
- [ ] Агрегований view (зустрічі + дедлайни + відпустки).
- [ ] Скасування → notify усім.
- [ ] Per-event timezone коректно рендериться.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

- **`CalendarEvent.agencyId`** + tenant-guard; `can('calendar.event.*')`.
- Зовнішні гості — через `notifyRecipient()` (D2, profile-less) + outbox; прибрати дубль у `inviteEmail.ts`.
- Per-event `timezone` (IANA) — рендер у TZ глядача (ризик R5). Aggregated view — read-only проєкція (без дублю стану).

### B. Booking-лінки (Calendly-style) ✅

- `BookingLink { id, agencyId, slug, durationMin, availability Json, isActive }`. Публічна сторінка → клієнт обирає вільний слот → авто-`CalendarEvent(client_meeting)` + notify. Anti-abuse: rate-limit + Turnstile на публічному роуті.

### C. Авто відео-дзвінок ✅

- `MeetingProvider`-адаптер (Zoom/Google Meet, як payments-провайдери) → авто-`meetingUrl` при створенні. Інтерфейс закладаємо зараз, імплементація фазована (OAuth-інтеграція).

> **→ BACKLOG (не обрано):** Календар держсвят (UA). Recurrence/ICS-експорт/зовнішні гості лишаються Phase 2 з тіла модуля.

```
CalendarEvent: + agencyId
New: BookingLink; MeetingProvider interface (packages)
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID         | Рішення                                                                                           | Вплив               | Нюанси власника                                                 |
| ---------- | ------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| 24-А       | **Авто-події з системи** (дедлайни, білінг-цикли, відсутності, dunning) шарами в одному календарі | [бек+екран]         | —                                                               |
| 24-Б       | **Інтеграція Google Calendar** (двостороння: події + busy-слоти)                                  | [бек помітний]      | Наголос власника                                                |
| 24-В       | **Типи бронювань** (тривалість/буфери/форма питань)                                               | [бек+екран дрібний] | —                                                               |
| 24-Г       | **«Запланувати дзвінок» із замовлення** (подія з клієнтом + лінк у тред)                          | [бек дрібний]       | —                                                               |
| 24-МІТИНГИ | **MeetingProvider: Google Meet + Zoom** — авто-створення відеолінка для зустрічей/бронювань       | [бек]               | Наголос власника: «інтеграція з гугл календарем, мітом і зумом» |

**Для ТЗ дизайнеру (попередньо):** календар із шарами джерел (А); налаштування типів бронювань (В); кнопка «запланувати дзвінок» у замовленні (Г); вибір відео-провайдера (МІТИНГИ).

---

## UPDATE (07.07.2026) — 24 CALENDAR MVP (Фаза 1) ✅ (реалізовано)

> Рішення власника (07.07): створює **owner + виконавець**; **reminder-cron у MVP**;
> UI — **місячна сітка**. Відпустки (модуль 23) відсутні → view = зустрічі + дедлайни.
> Зовнішні email-гості й recurrence — Фаза 2.

- **Моделі** (міграція `20260707_calendar`, RLS): `CalendarEvent {agencyId, title, description?,
type, startsAt, endsAt, timezone(IANA), location?, meetingUrl?, companyId?, createdById,
cancelledAt?}`, `CalendarAttendee {agencyId, eventId, profileId, response, respondedAt?}`
  @@unique([eventId,profileId]). Енуми CalendarEventType(internal/client_meeting),
  AttendeeResponse(pending/accepted/declined). Relations + FK (agency/company/createdBy/profile).
- **API:** POST/GET `/calendar/events` (create+invite owner/executor; список свої+де запрошений),
  PATCH `:id` (creator/owner), POST `:id/cancel`, POST `:id/respond` (accept/decline),
  GET `/calendar/view?from&to` (зустрічі + дедлайни замовлень як read-only проєкція; клієнт —
  лише дедлайни своїх компаній). Валідація запрошених (член агенції або компанії події).
- **Нотифікації** (in-app): calendar.invited/updated/cancelled + **reminder-cron** (кожні 15хв,
  вікно [now+45; now+60]хв → рівно один прогін). Нова категорія CALENDAR у матриці.
- **⚠️ Виправлено загальний баг нотифікацій:** нові категорії (SUPPORT, CALENDAR) не мали
  preference-рядків у НАЯВНИХ користувачів → in-app мовчки губились. Резолвер тепер дефолтить
  IN_APP для «неконфігурованої» категорії (0 рядків) і поважає явне «все вимкнено»; міграція
  бекфілить обидві категорії × 3 канали для наявних NotificationSettings.
- **UI:** workspace `/calendar` (нав «Робота») — місячна grid-сітка (зустрічі + ⏳ дедлайни),
  create-модалка (тип/дата/час/локація/лінк/запрошені команда+клієнт), клік події → деталь
  (учасники+відповіді, скасувати). Портал `/calendar` («Зустрічі») — список запрошень +
  accept/decline. TZ per-event рендериться у tz події.
- **Гейт:** +5 unit (api **909**), turbo 56/56, інтеграційні 155/155, drift-free. Вживу:
  owner створив client-зустріч → клієнт бачить + нотиф → accept → view злив зустріч+дедлайни →
  reminder-cron надіслав нагадування; cancel notify.
- **Відкладено (Фаза 2):** зовнішні email-гості (D2), recurrence, ICS, booking-лінки, відео-провайдери.
