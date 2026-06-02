# CLIENT MANAGEMENT MODULE (агенція керує клієнтами)

> App: Workspace (work.workflo.space) / API · Залежить від: **01-auth** (Profile/Company/CompanyMember), **17-credentials**, **26-leads** (конверсія→клієнт).
> Статус: **Спец** · Створено: 1.06.2026 · Модуль **28** (новий — закриває прогалину аудиту 1.06).
> Заповнює діру: зараз керування командою компанії — лише **self-service власника** (13-settings, з Portal). Агенційного боку (owner керує клієнтом) **немає**; 26-leads уже посилається на цей модуль.

---

## 0. Навіщо

Owner/команда агенції мусять **повноцінно вести клієнта** з воркспейсу: редагувати картку компанії-клієнта, **скинути пароль** користувачу клієнта, керувати **командою клієнта** (запросити/зняти/змінити роль), (де)активувати/офбордити клієнта. Зараз `/clients/:id` — read-only + `notes`. Це CRM-адмінування, окреме від self-service клієнта.

Tenant: усе agency-scoped (`agencyId` + `isInternalTeam`) + кожна дія в `audit_logs` (чутливі операції над чужим акаунтом).

---

## 1. Функції / API (Workspace, `isInternalTeam` + agency-scoped)

| Метод    | URL                                                               | Опис                                                                    | Право       |
| -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------- |
| `GET`    | `/workspace/clients`                                              | Список клієнтів (Company) агенції + фільтри/пошук/lTV/лояльність        | team        |
| `GET`    | `/workspace/clients/:companyId`                                   | Картка: інфо + члени + замовлення + білінг + credentials + lead-джерело | team        |
| `PATCH`  | `/workspace/clients/:companyId`                                   | Редагувати картку (name/notes/currency/language/tierOverride/реквізити) | owner/admin |
| `GET`    | `/workspace/clients/:companyId/members`                           | Команда клієнта                                                         | team        |
| `POST`   | `/workspace/clients/:companyId/members/invite`                    | Запросити користувача клієнта (agency-side)                             | owner/admin |
| `PATCH`  | `/workspace/clients/:companyId/members/:profileId`                | Змінити роль/права члена клієнта                                        | owner/admin |
| `DELETE` | `/workspace/clients/:companyId/members/:profileId`                | Зняти члена (профіль лишається)                                         | owner/admin |
| `POST`   | `/workspace/clients/:companyId/members/:profileId/reset-password` | **Адмін-скидання пароля** (див. §2)                                     | owner/admin |
| `POST`   | `/workspace/clients/:companyId/deactivate`                        | Деактивувати клієнта (read-only, не видаляти)                           | owner       |
| `POST`   | `/workspace/clients/:companyId/export`                            | Експорт даних клієнта (GDPR, на запит) → RETENTION.md                   | owner       |

> Перевикористовує наявне: invite-флоу (`createMemberInvite`), `provisionAgency`-стиль провіжну, credentials (17). Не дублює self-service (13-settings) — це агенційний паралель.

## 2. Admin password reset (рішення — потребує підтвердження власника)

Чутлива операція. Варіанти (зафіксувати перед реалізацією):

- **A (рекоменд.): надіслати reset-лінк** — owner тисне «Скинути пароль» → юзеру лист із reset-посиланням (як forgot-password). **Owner НІКОЛИ не бачить пароль.** Найбезпечніше.
- **B: тимчасовий пароль** — згенерувати + показати раз + примус зміни при першому вході (для юзерів без email).
- **C: обидва** (link + fallback).

Будь-який варіант: інвалідувати наявні сесії (`tokenVersion++`), `audit_logs(action='client.password_reset_by_admin')`, notify юзера.

## 3. Lifecycle клієнта (агенційний бік)

- **Активний → Деактивований** (read-only): замовлення лишаються, нові — ні; клієнт не логіниться. Зворотно.
- **Офбординг:** контрольований експорт (owner на запит клієнта) + (за згодою/політикою) видалення → LIFECYCLE.md + RETENTION.md (anonymize vs purge).
- Конверсія **лід→клієнт** (26-leads §4) створює Company тут.

## 4. Безпека

- Усе `isInternalTeam` + agency-scoped; крос-тенант неможливий.
- Адмін-дії над акаунтом клієнта (reset/deactivate/role) — **owner/admin-only** через `can()` + **обовʼязковий audit**.
- Reset-пароля не розкриває пароль owner'у (варіант A).

## 5. Фази

- **P1:** клієнт-CRUD (картка/notes/tierOverride), agency-side member-mgmt (invite/role/remove), **admin-reset-password**, deactivate.
- **P2:** офбординг-експорт-флоу, bulk-операції, сегменти клієнтів.
- API — design-independent (backend-фаза); екрани — фронтенд-прохід (картка клієнта вже є в UX_PAGES `/companies/:id`).
