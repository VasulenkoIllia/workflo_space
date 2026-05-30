# LEAVE / VACATION MODULE

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
