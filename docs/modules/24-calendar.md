# CALENDAR / MEETINGS MODULE

> App: Workspace + Portal (clients see meetings they're invited to)
> Статус: Проєктування (post-MVP, complexity: L — large)
> Залежить від: `07-notifications` (з розширенням recipient), `01-auth`, `23-leave`
> Оновлено: 29 травня 2026

---

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

| Method  | Path                               | Auth                       | Опис                                    |
| ------- | ---------------------------------- | -------------------------- | --------------------------------------- |
| `POST`  | `/calendar/events`                 | executor / owner           | Створити зустріч + запросити            |
| `GET`   | `/calendar/events?from=&to=&type=` | any (свої + де запрошений) | Список для view                         |
| `PATCH` | `/calendar/events/:id`             | creator / owner            | Редагувати (час, місце)                 |
| `POST`  | `/calendar/events/:id/cancel`      | creator / owner            | Скасувати (+notify усім)                |
| `POST`  | `/calendar/events/:id/respond`     | invitee                    | accept / decline                        |
| `GET`   | `/calendar/view?from=&to=`         | any                        | Агрегований: events + deadlines + leave |

`can()`: `calendar.event.create/update/cancel/invite`. Політика: owner може зустріч з клієнтом; чи може executor самостійно — рішення (рекомендую так, з notify owner'у).

---

## Notifications (reuse + D2 recipient)

Нові events: `calendar.invited`, `calendar.updated`, `calendar.cancelled`, `calendar.reminder`.

- Для Profile-учасників — через матрицю.
- Для зовнішніх email-гостей — через `notifyRecipient()` (D2).
- **Reminder** — cron (модель як `C03 dueDateReminder`): за 1 год / 1 день до `startsAt`.

---

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
