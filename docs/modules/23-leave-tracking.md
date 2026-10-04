# LEAVE / VACATION MODULE

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> ✅ **S13-04/05 ЗБУДОВАНО (2026-07-11, Enhancement №2):** `LeaveRequest` (agencyId+forced-RLS,
> profileId за конвенцією проєкту, days = робочі дні пн–пт) + `AgencyMember.hireDate` +
> `Agency.vacationDaysPerYear`. Роути `/workspace/leave` (self-подача з overlap-guard · список
> self-vs-others · balance accrual-обчислюваний · approve/reject owner+manager з балансовим
> guard на vacation і забороною self-approve менеджеру · cancel). Нотифікації
> `team.leave_requested`/`team.leave_status_changed` + audit. UI `/leave` «Відсутності»
> (дизайн calendar-plus WsLeaves). Відхилення від тіла модуля: hireDate на AgencyMember
> (не ExecutorRate — там історія ставок, N рядків); LeaveBalance-таблиці нема — баланс
> обчислюваний (без крону). Follow-ups: календар-шар · 23-А capacity · 23-Б свята · 23-В Telegram · 23-Г конфлікт-ворнінг.
>
> App: Workspace (executor self-service + owner approval)
> Статус: Проєктування (post-MVP, complexity: S — small)
> Залежить від: `12-team-executors`, `07-notifications`, `24-calendar` (availability)
> Оновлено: 29 травня 2026

---

## Огляд

Облік відпусток / лікарняних / відгулів працівників (executors). Executor подає запит → owner затверджує/відхиляє → запис стає видимим у командному календарі як «недоступність».

**Чому це просто (S):** одна таблиця + 4 endpoints + reuse наявної інфри (`can()`, notifications, audit). Єдина нова authz-логіка: «executor діє над власним ресурсом, owner — над будь-чиїм».

---

## Модель даних

```prisma
enum LeaveType {
  vacation     // щорічна відпустка
  sick         // лікарняний
  unpaid        // без збереження
  personal     // особистий день
}

enum LeaveStatus {
  pending
  approved
  rejected
  cancelled
}

model LeaveRequest {
  id          String      @id @default(uuid())
  executorId  String
  executor    Profile     @relation("LeaveExecutor", fields: [executorId], references: [id])
  type        LeaveType
  startDate   DateTime    @db.Date          // день, не мить — відпустка по днях
  endDate     DateTime    @db.Date
  status      LeaveStatus @default(pending)
  reason      String?
  reviewedById String?
  reviewedBy   Profile?   @relation("LeaveReviewer", fields: [reviewedById], references: [id])
  reviewedAt  DateTime?   @db.Timestamptz(3)
  createdAt   DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime    @updatedAt @db.Timestamptz(3)

  @@index([executorId, startDate])
  @@index([status])
  @@map("leave_requests")
}
```

**Передумова (S1.5 hardening):** `ExecutorRate.hireDate` потрібен для accrual (скільки днів відпустки накопичено). Додаємо заздалегідь — див. BACKLOG «S1.5 schema prep».

---

## Endpoints

| Method | Path                         | Auth                       | Опис                |
| ------ | ---------------------------- | -------------------------- | ------------------- |
| `POST` | `/leave`                     | executor                   | Подати запит (свій) |
| `GET`  | `/leave?executorId=&status=` | executor(свої)/owner(всі)  | Список              |
| `POST` | `/leave/:id/approve`         | owner                      | Затвердити          |
| `POST` | `/leave/:id/reject`          | owner                      | Відхилити (+reason) |
| `POST` | `/leave/:id/cancel`          | executor(свій, до approve) | Скасувати           |

### Нова authz-логіка (розширення `can()`)

- `leave.request` — будь-який executor (для себе).
- `leave.approve` / `leave.reject` — owner агенції / admin.
- `leave.cancel` — автор запиту, поки `status='pending'`.

Це перший «self vs others» кейс для внутрішньої команди → додаємо у `can()` правило: executor може діяти над `resource.executorId === user.sub`.

---

## Notifications (reuse матриці 07)

Нові events (категорія `team` або reuse `system`):

- `team.leave_requested` → owner (новий запит на розгляд).
- `team.leave_status_changed` → executor (затверджено/відхилено).

Near-zero cost — матриця підхопить автоматично після додавання у `NotificationEvent` + `EVENT_TO_CATEGORY`.

---

## Інтеграція

- **Calendar (24):** approved leave рендериться у командному календарі як «зайнятість» (тип події `leave`). **Дизайн-рішення:** date-range модель leave має бути сумісна з availability-view календаря, щоб не будувати дві системи дат. Див. архітектурну рекомендацію D3.
- **Time tracking (02/12):** executor на відпустці не може стартувати таймер у ці дні (UI guard + опційна API-перевірка).
- **Reports (19):** «хто у відпустці» + залишок днів у workload-звіті.
- **Audit:** `leave.approved` / `leave.rejected` → audit_logs (free).

---

## Accrual (Фаза 2)

Накопичення днів відпустки (напр. 1.75 дня/міс від `hireDate`) — окремий розрахунок, опційно. MVP: owner просто approve/reject без автоматичного балансу.

---

## Acceptance (Фаза 1)

- [ ] Executor подає запит на діапазон дат.
- [ ] Owner бачить pending-запити, approve/reject з reason.
- [ ] Notification обом сторонам.
- [ ] Approved leave видно у календарі (коли 24 готовий).
- [ ] Усі дії в audit_logs.

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нова фіча

### A. Обов'язкові reconcile

- **`LeaveRequest.agencyId`** + tenant-guard. `can()` self-vs-others (executor над власним; owner над будь-чиїм) — перше таке правило, додати в ADR-002 shim.
- `ExecutorRate.hireDate` (S1.5 schema-prep) — потрібен для accrual; додати заздалегідь.
- Notify events `team.leave_requested`/`team.leave_status_changed` → через матрицю (07) + outbox.

### B. Баланс/квота відпусток ✅

- `LeaveBalance { executorId, agencyId, type, year, accruedDays, usedDays }` + accrual-cron (напр. 1.75 дн/міс від `hireDate`). Залишок по типах; guard «не більше за баланс» на approve. Підтверджує Phase 2 з тіла модуля як обрану.

> **→ BACKLOG (не обрано):** Календар держсвят (UA) — авто-виключення з робочих днів/accrual. Винесено окремо.

```
LeaveRequest: + agencyId
New: LeaveBalance
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                          | Вплив              | Нюанси власника |
| ---- | -------------------------------------------------------------------------------- | ------------------ | --------------- |
| 23-А | Відпустка автоматично знижує capacity (звʼязка 12-Б)                             | [бек] дрібний      | —               |
| 23-Б | Типи відсутностей + святковий календар per-agency (впливає на дедлайни/SLA/07-Б) | [бек+налаштування] | —               |
| 23-В | Погодження заявок у Telegram (inline-кнопки, механіка 15-А)                      | [бек]              | —               |
| 23-Г | Конфлікт-ворнінг «відсутність × дедлайни виконавця» при апруві                   | [бек] дрібний      | —               |
