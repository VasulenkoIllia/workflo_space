# BACKLOG

**Призначення:** capture-буфер для ідей, фіч та доопрацювань, які не входять у поточний спринт але мають бути зафіксовані, щоб не загубитися. Не плутати з `TRACKER.md` (живі задачі) чи модульними доками (стабільні рішення).

---

## Workflow

1. **Зловив ідею під час кодингу/обговорення** → додав запис у відповідну секцію нижче.
2. **Планування спринту** → переглядаємо BACKLOG, обираємо що тягнемо у `TRACKER.md`, інше залишаємо.
3. **Реалізували** → видаляємо з BACKLOG, додаємо у TRACKER зі статусом done (для аудиту).
4. **Розчарувалися в ідеї** → видаляємо без переходу у TRACKER (раз на місяць).

Формат запису:

```
- [контекст] Короткий опис ідеї. Пояснення user value. (created: YYYY-MM-DD)
```

---

## 🚀 Нові фічі (не блокують MVP)

- [analytics] Дашборд retention клієнтів (NEW → REGULAR conversion rate, P50 time-to-second-order). (created: 2026-04-15)
- [ux] Темна тема у portal — зараз тільки у workspace; портал у legacy "always light". (created: 2026-04-16)
- [integrations] Slack notification adapter — паралельно з Telegram, але для команд клієнтів з Slack як основним каналом. (created: 2026-04-16)
- [bot] Inline buttons для швидких відповідей у Telegram (approve/reject/comment) — зараз тільки text. (created: 2026-04-18)
- [reports] Експорт reports у PDF (поточно лише CSV + on-screen). (created: 2026-04-22)
- [credentials] Двофакторне підтвердження для credentials.read (TOTP або email-link), а не лише owner role. (created: 2026-04-23)
- [finance] Фаза 2 модуля фінансів — маржа по кожному клієнту (cost allocation: equal/weighted/by_revenue розподіл спільних витрат на клієнтів). Робимо після наповнення реєстру витрат реальними даними. Див. modules/22-finance-expenses.md. (created: 2026-05-29)

## 🛠 Технічний борг

- [api] Centralized error formatter — зараз кожен handler формує `{error: {...}}` сам, варто винести у helper. (created: 2026-04-14)
- [db] Migration smoke test — script що накатує всі міграції на чистий PG і запускає seed (для CI). (created: 2026-04-15)
- [notifications] Bulk send для масових розсилок (newsletter, system maintenance) — поточно `notify()` per-profile, для 1000+ recipient'ів буде overkill. (created: 2026-04-22)
- [auth] Захоплення геолокації + UA при login + audit-log запис для security. (created: 2026-04-22)
- [orders] Soft-delete UI для відновлення deleted orders (admin-only, 30d window). (created: 2026-04-18)

## 🧪 Потребує дослідження

- [billing] Stripe vs LiqPay для прийому платежів у production. Зараз manual + bank transfer. (created: 2026-04-15)
- [storage] Перейти з local FS на S3-compatible (Cloudflare R2)? Backups+CDN з коробки. Вартість vs Hetzner volume. (created: 2026-04-16)
- [rbac] Чи потрібен повноцінний CASL? Чи `can()` shim вистачить навіть для enterprise? (task #24) (created: 2026-04-19)

## 📚 Документація

- [docs] Сторінка статусів `/status` (uptime, last deploy, planned maintenance). (created: 2026-04-15)
- [docs] Public API docs — Swagger UI для майбутніх integration партнерів. (created: 2026-04-20)
- [docs] Runbook для on-call: "що робити коли SMTP/Telegram/DB лягло". (created: 2026-04-22)

## 🐛 Виявлені баги (без severity SEV0/1)

- _(порожньо станом на 2026-05-27)_

---

> **Правило:** якщо ідея сидить у BACKLOG > 90 днів без обговорень — видаляємо її. Не реалізовано = не потрібно зараз.
