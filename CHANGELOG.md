# CHANGELOG

> Формат: [Keep a Changelog](https://keepachangelog.com/uk/1.0.0/)
> Версіонування: [SemVer](https://semver.org/lang/uk/)

> ⚠️ **Цей файл відстав від реальності (аудит 2026-06).** Поточний достовірний стан —
> `git log` + `TRACKER.md`. Приклади/чернетки нижче можуть містити застарілі рішення
> (Bronze/Silver/Gold лояльність, react-pdf, GPT-4) — НЕ джерело істини. Наповнити
> ретроспективно з git-тегів при першому релізі (v0.1.0), далі вести за правилами нижче.

---

## Як вести CHANGELOG

### Правила

1. **При кожному merge `dev → main`** — вносимо запис у відповідний розділ
2. **При тегуванні** (`git tag v0.x.0`) — розділ `[Unreleased]` перетворюємо на `[v0.x.0] - YYYY-MM-DD`
3. **Новий unreleased** — одразу відкриваємо порожній `[Unreleased]` після тегу
4. **Ніколи не редагуємо** вже опубліковані версії — тільки додаємо нові

### Типи змін

| Тип          | Коли                              |
| ------------ | --------------------------------- |
| `Added`      | Нова функція                      |
| `Changed`    | Зміна існуючої функції            |
| `Fixed`      | Виправлення бага                  |
| `Removed`    | Видалення функції                 |
| `Security`   | Виправлення вразливості           |
| `Deprecated` | Застаріла функція (буде видалена) |

### Приклад запису

```markdown
## [v0.2.0] - 2026-05-01

### Added

- Auth: реєстрація, логін, refresh token rotation, invite flow
- Orders: CRUD, статусна машина, призначення виконавців
- Comments: чат з SSE real-time (PostgreSQL LISTEN/NOTIFY)
- Files: завантаження файлів, LocalStorageAdapter

### Fixed

- Auth: некоректний редирект після invite accept

### Changed

- API: стандартизований error response формат `{success, error: {code, message}}`
```

---

## [Unreleased]

> Зміни що ще не потрапили в production release.

### Added

- Повна документація проекту (16 модульних docs, infrastructure, frontend standards, UX pages, scaffold, git workflow)
- Monorepo структура: Turborepo + pnpm workspaces, 5 apps + 8 packages
- Налаштування CI/CD pipeline (GitHub Actions: staging + production)
- Prisma DB schema (фінальна v1.0)

---

<!-- Приклад як буде виглядати після першого релізу: -->

<!--
## [v0.1.0] - 2026-06-01

### Added
- Foundation: monorepo, CI/CD, Docker, Traefik, DNS, Mailcow
- Auth: register, login, logout, refresh (rotation + reuse detection), forgot/reset password, invite flow
- Orders: CRUD, status machine (9 internal → 4 client), executor assign, soft delete
- Comments: real-time chat via SSE + PostgreSQL NOTIFY, internal notes, file attachments
- Files: upload/download, LocalStorageAdapter, access control
- Billing: manual payments, advance tracking, balance_due calculation, billing plans
- Documents: PDF generation (@react-pdf/renderer), 5 types, INV-2026-NNNN numbering
- Notifications: Email (Nodemailer+Mailcow) + Telegram (grammY) adapters
- Referral: depth=1, workflo-XXXXXX codes, bonus on first payment
- Loyalty: Bronze/Silver/Gold/Platinum tiers, 1pt=$0.01, 30% max discount
- Blog: Markdown + AI generation (GPT-4) + Next.js ISR + on-demand revalidation
- Team: executor invite, time tracking, workload dashboard
- Settings: profile, company, members, notifications, system (owner)
- Landing: Next.js 15, next-intl (uk/en), SEO, sitemap
- Bot: grammY, OTP account linking, push notifications
- Search: PostgreSQL tsvector + GIN indexes, global search, autocomplete
- Portal SPA: all client-facing pages (React + Vite + TanStack Query)
- Workspace SPA: all internal pages + Kanban board (dnd-kit)
-->
