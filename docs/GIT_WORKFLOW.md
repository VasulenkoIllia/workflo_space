# GIT WORKFLOW
> Угода команди про гілки, коміти, PR і релізи.
> Версія: 1.0 | Оновлено: 12 квітня 2026

---

## ЗМІСТ

1. [Гілки](#1-гілки)
2. [Commit conventions](#2-commit-conventions)
3. [PR процес](#3-pr-процес)
4. [Деплой flow](#4-деплой-flow)
5. [Hotfix](#5-hotfix)
6. [Правила захисту гілок](#6-правила-захисту-гілок)
7. [Команди для щоденної роботи](#7-команди-для-щоденної-роботи)

---

## 1. ГІЛКИ

```
main          ← production (захищена, тільки через PR)
dev           ← staging (захищена, тільки через PR)

feature/*     ← нова функція
fix/*         ← виправлення бага
chore/*       ← рефакторинг, залежності, конфіг
docs/*        ← тільки документація
hotfix/*      ← термінове виправлення в production (від main)
```

### Від якої гілки стартуємо

```
feature/* fix/* chore/* docs/*  →  стартуємо від dev
hotfix/*                        →  стартуємо від main
```

### Іменування гілок

```
Формат: type/TASK-ID-short-description

Приклади:
feature/S1-04-auth-register
feature/S2-06-sse-comments
fix/S3-12-portal-login-redirect
fix/S4-07-kanban-drag-drop
chore/S0-02-tsconfig-setup
chore/update-prisma-5.11
docs/update-billing-module
hotfix/broken-refresh-token
```

**Правила:**
- Тільки латиниця, цифри, дефіси — ніяких пробілів і спецсимволів
- Максимум 50 символів
- Описово але коротко

---

## 2. COMMIT CONVENTIONS

Використовуємо **Conventional Commits** — машиночитабельний формат.

### Формат

```
type(scope): короткий опис

[опціональне тіло — деталі якщо потрібно]

[опціональний footer: Closes S1-04]
```

### Types

| Type | Коли використовувати |
|---|---|
| `feat` | Нова функціональність |
| `fix` | Виправлення бага |
| `chore` | Рефакторинг, залежності, конфіг, build |
| `docs` | Тільки зміни в документації |
| `test` | Додавання або виправлення тестів |
| `style` | Форматування, відступи (не змінює логіку) |
| `perf` | Оптимізація продуктивності |
| `ci` | Зміни в CI/CD workflows |

### Scopes

```
auth, orders, billing, documents, notifications, referral, loyalty,
blog, team, settings, search, bot,
portal, workspace, landing, api,
db, ui, types, i18n, storage, payments, templates,
infra, ci
```

### Приклади

```bash
# Нова функція
feat(auth): add refresh token rotation with reuse detection

# Виправлення
fix(orders): prevent invalid status transition from done to in_progress

# Кілька файлів — основне в scope
feat(billing): implement loyalty points deduction on payment

# Без scope (якщо змінює кілька несвязаних речей)
chore: update all dependencies to latest minor versions

# З тілом
feat(notifications): add in-app bell with SSE stream

Bell icon subscribes to /notifications/stream via EventSource.
Unread count badge updates in real-time.
Clicking notification marks it as read and navigates to related entity.

Closes S4-09

# Breaking change (якщо є)
feat(api)!: change pagination format from array to {items, pagination}

BREAKING CHANGE: all list endpoints now return {items: [], pagination: {}}
instead of bare arrays. Update all frontend consumers.
```

### Правила

1. **Короткий опис** — max 72 символи, починається з дієслова в теперішньому часі
   - ✅ `add refresh token rotation`
   - ❌ `Added refresh token rotation` (минулий час)
   - ❌ `Refresh token rotation` (не починається з дієслова)
2. **Без крапки** в кінці першого рядка
3. **Якщо закриває задачу** — `Closes S1-04` в footer
4. **Дрібні правки** можна без scope: `fix: correct typo in email template`

---

## 3. PR ПРОЦЕС

### Крок за кроком

```
1. Стартуємо від dev:
   git checkout dev && git pull
   git checkout -b feature/S1-04-auth-register

2. Пишемо код (кілька комітів — окей)

3. Перед PR — rebase на актуальний dev:
   git fetch origin
   git rebase origin/dev

4. Push:
   git push origin feature/S1-04-auth-register

5. Створюємо PR: feature/... → dev
   - Заповнюємо PULL_REQUEST_TEMPLATE.md
   - Assignee: себе
   - Reviewer: owner (завжди)

6. CI проходить автоматично:
   - lint ✅
   - type-check ✅
   - tests ✅

7. Code review → approve

8. Merge (squash merge):
   Назва squash коміту = feat(auth): add register endpoint (S1-04)

9. Видаляємо гілку після merge (GitHub автоматично)
```

### Merge стратегія: Squash Merge

**Чому squash:**
- `dev` і `main` мають чисту, читабельну історію
- 1 PR = 1 коміт у `dev`
- Кожен коміт в `dev` = задача з TRACKER.md
- Легко `git log` щоб побачити що зроблено за тиждень

**Squash commit title формат:**

```
feat(auth): add refresh token rotation (S1-07)
fix(orders): correct status transition validation (S2-03)
chore(infra): setup Dockerfile for all 5 apps (S0-20)
```

### Code review правила

| Ситуація | Хто review |
|---|---|
| `packages/db/schema.prisma` | Тільки Owner (обов'язково) |
| `docker/`, `.github/workflows/` | Тільки Owner (обов'язково) |
| `packages/types/` | Owner або старший в команді |
| Всі інші | Мінімум 1 reviewer (можна будь-хто з команди) |

**Що перевіряємо при review:**
1. Логіка відповідає задачі
2. Немає `console.log` або дебаг коду
3. Немає захардкоджених секретів
4. TypeScript без `any` (якщо є — обґрунтування в коментарі)
5. Обробка помилок є
6. Для нових API endpoint — схема Zod є

### Draft PR

Якщо хочеш feedback до завершення — відкривай **Draft PR**. CI запускається, можна коментувати, але не merge поки не зняли Draft.

---

## 4. ДЕПЛОЙ FLOW

```
feature/* ──→ dev ──→ staging (автоматично) ──→ main ──→ production (ручний approve)
```

### Staging (автоматично при push в dev)

```yaml
# .github/workflows/staging.yml спрацьовує при:
on:
  push:
    branches: [dev]
```

Після merge будь-якого PR в `dev` → staging автоматично оновлюється за ~5 хвилин.

### Production (ручний approve)

```yaml
# .github/workflows/production.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    environment: production  # ← вимагає manual approval у GitHub
```

**Release PR: `dev → main`**

Формат: PR відкривається вручну в кінці спринту або при готовності до деплою.

```
PR title:   Release v0.2.0 — Sprint 1 complete

PR body:
## Що в релізі
- feat(auth): register, login, refresh, invite flow
- feat(orders): CRUD, status machine, SSE comments
- feat(files): upload, download, LocalStorageAdapter

## Тестування на staging
- [x] Auth flow пройшов
- [x] Замовлення створюються і змінюють статус
- [x] Email нотифікації приходять

## Rollback plan
Якщо щось не так: ./scripts/rollback.sh
```

### Release теги

Після merge в `main` — одразу тег:

```bash
git tag v0.2.0 -m "Sprint 1: Auth + Orders"
git push origin v0.2.0
```

Версіонування: **SemVer**
- `v0.x.0` — MVP спринти (minor = завершений спринт)
- `v1.0.0` — перший публічний реліз (перший реальний клієнт)
- `v1.0.x` — hotfixes (patch)

---

## 5. HOTFIX

Термінове виправлення production без проходження через staging.

```bash
# 1. Стартуємо від main
git checkout main && git pull
git checkout -b hotfix/broken-refresh-token

# 2. Фіксимо

# 3. PR hotfix/* → main
# В PR description: позначаємо як HOTFIX, описуємо проблему

# 4. Owner review → approve → merge в main
# 5. Автоматичний деплой production

# 6. Cherry-pick або merge назад в dev
git checkout dev && git pull
git cherry-pick <hotfix-commit-hash>
git push origin dev

# Або merge:
# git merge hotfix/broken-refresh-token
# git push origin dev
```

**Hotfix PR:**
- Заголовок: `hotfix: fix broken refresh token rotation`
- Не потрібен staging deploy — тільки якщо є час
- Після merge в main — одразу тег: `v1.0.1`
- Пріоритет review: Owner завжди перший

---

## 6. ПРАВИЛА ЗАХИСТУ ГІЛОК

Налаштовуємо в GitHub: Settings → Branches → Branch protection rules

### `main` (production)

```
✅ Require a pull request before merging
✅ Required approvals: 1 (Owner)
✅ Require status checks to pass:
   - lint
   - type-check
   - test
✅ Require branches to be up to date before merging
✅ Restrict who can push: тільки GitHub Actions (deploy bot)
✅ Do not allow bypassing the above settings
```

> Примітка: для private репозиторію на GitHub Free ці правила недоступні.
> Варіанти: зробити repo public або перейти на GitHub Pro/Team.

### `dev` (staging)

```
✅ Require a pull request before merging
✅ Required approvals: 1
✅ Require status checks to pass:
   - lint
   - type-check
   - test
✅ Require branches to be up to date before merging
```

---

## 7. КОМАНДИ ДЛЯ ЩОДЕННОЇ РОБОТИ

### Старт нової задачі

```bash
# Оновлюємо dev
git checkout dev
git pull origin dev

# Нова гілка
git checkout -b feature/S2-05-order-comments

# Перевіряємо що все збирається
pnpm --filter api dev
```

### В процесі роботи

```bash
# Маленькі атомарні коміти — норма
git add src/routes/comments/
git commit -m "feat(comments): add POST /orders/:id/comments endpoint"

git add src/routes/comments/stream.ts
git commit -m "feat(comments): add SSE stream with pg LISTEN/NOTIFY"
```

### Перед PR

```bash
# Актуалізуємо з dev
git fetch origin
git rebase origin/dev

# Перевіряємо все
turbo lint
turbo type-check
turbo test

# Push
git push origin feature/S2-05-order-comments

# Якщо після rebase потрібен force push (тільки своєї feature гілки!)
git push --force-with-lease origin feature/S2-05-order-comments
```

### Після merge PR

```bash
# Видаляємо локальну гілку
git checkout dev
git pull
git branch -d feature/S2-05-order-comments

# Перевіряємо staging
# https://dev.workflo.space або https://dev-app.workflo.space
```

### Корисні аліаси (додати в ~/.gitconfig)

```ini
[alias]
  # Красивий лог
  lg = log --oneline --graph --decorate --all
  
  # Статус коротко
  st = status -sb
  
  # Нова гілка від dev
  nb = "!f() { git checkout dev && git pull && git checkout -b $1; }; f"
  # Використання: git nb feature/S1-04-auth-register
  
  # Швидкий WIP коміт
  wip = "!git add -A && git commit -m 'chore: WIP'"
  
  # Скасувати WIP
  unwip = reset HEAD~1 --soft
```

---

## ПІДСУМОК (Quick Reference)

```
Нова задача:     git checkout dev && git pull && git checkout -b feature/S_-__-name
Коміт:           feat(scope): description (Closes S_-__)
PR:              feature/* → dev, squash merge, 1 reviewer
Staging:         автоматично при merge в dev
Production:      PR dev → main + manual approve в GitHub
Hotfix:          hotfix/* від main → PR → main → cherry-pick → dev
Release тег:     git tag v0.x.0 && git push origin v0.x.0
```
