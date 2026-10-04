# design-v2 — оновлений дизайн-бандл (Claude Design)

**Імпортовано:** 2026-06-20 через **Claude Design MCP** (конектор `claude_design`, проєкт `5c06fb7a-dbf6-40d3-850b-e7eae95e763f`, entry-файл `workflo-prototype.html`).

Це **наступна ітерація** дизайну після `design/` (старий бандл, Round 6). Старий лишено поряд навмисно (рішення власника — тримати обидва для diff). Канонічним для коду стає **цей** бандл.

## Що тут

- `project/` — **159 source-файлів** прототипу (HTML/CSS/JS + React-Babel standalone `.jsx`). Entry: [`project/workflo-prototype.html`](project/workflo-prototype.html) — клікабельний end-to-end (лендінг · портал · workspace).

## Чим відрізняється від `design/` (старого)

Новий бандл реалізує спеку власника з проходу по 29 модулях (11–12.06): `docs/DESIGN_TZ_2026-06.md` + консолідовано в `docs/DESIGN_SPEC_FULL.md`. Додані модулі (раніше не було):

- **Проєкти/дошка:** `workspace-board*` (kanban + task-картка + модали), `workspace-project360*` (Project-360)
- **Клієнт 360°:** `workspace-client360*` (+tabs, еволюція `workspace-clients`)
- **Фінмодель 2.0:** `workspace-finprojects*`, `workspace-margin`
- **Каталог послуг:** `workspace-svccatalog*`; **Замовлення:** `workspace-orders-v2`
- **Аудит/нотифікації/звіти:** `workspace-audit`, `workspace-notify*`, `workspace-reports-v1*`
- **Чат замовлення (SSE):** `order-chat`
- **Секрети/доступи:** `portal-secrets`; **EU/юр-особи:** `workspace-documents-eu`
- **Режими P2B/P2C + хаби + role-based IA:** `workspace-p2b`, `workspace-p2c`, `portal-p2c`, `portal-client-p1`, `workspace-hubs`, `workspace-billing-hub`, `workspace-landing-hub`, `ia-roles.css`
- **Інше:** `workspace-case-editor`, `workspace-testimonials`, `workspace-calendar-plus`, `workspace-support-plus`, responsive-шари (`*-responsive.css`)

## Примітки до імпорту

- Тягнули лише **source-файли**. `screenshots/` (рендери) і `uploads/` (це копії наших же доків, завантажені в дизайн-тул) — **пропущено** (не потрібні для коду/аудиту; рендери лишилися в Claude Design).
- На відміну від ручного handoff-експорту (яким зроблено старий `design/`), MCP-імпорт **не містить `chats/`** (транскриптів). Якщо потрібні — зробити ручний Export з claude.ai/design.

## Як використовувати

Орієнтир зв'язку дизайн↔код — `docs/DESIGN_SYSTEM.md` (токени §3, матриця покриття §5, workflow-гейт §7). Токени — лише через `--wf-*`, джерело: [`project/styles.css`](project/styles.css) + `project/product-styles.css`.
