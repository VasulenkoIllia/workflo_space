# S4 Workspace — План тестування + серверний чек-лист

> Сприйнятна аудиторія: власник, який тестує **на сервері** (staging `dev-*.workflo.space`).
> Пов'язано: [`TRACKER.md`](TRACKER.md) (SPRINT 4) · [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) · [`docker-compose.staging.yml`](../docker-compose.staging.yml).
> Створено: 2026-06-08 (після аудиту S4).

Workspace = окрема SPA на `work.workflo.space` (staging: `dev-work.workflo.space`), доступна **лише команді** (owner+executor) за **IP-whitelist**. Клієнти користуються Porталом.

---

## A. Що залити/заповнити на сервері (щоб збиралось і стартувало)

CI **вже повністю** збирає, пушить і деплоїть `workspace` (матриця `landing/portal/workspace/api/bot` у `.github/workflows/staging.yml` + `production.yml`; `compose up -d workspace`; healthcheck). Образ `ghcr.io/<owner>/workflo-workspace:sha-<commit>`. Тобто **код-частина деплою готова** — потрібно лише заповнити середовище.

### A1. GitHub Actions secrets (репозиторій → Settings → Secrets)

Потрібні для деплою по SSH (вже мають бути з S0, перевір наявність):

- `HETZNER_HOST` — IP/домен сервера
- `HETZNER_SSH_USER` — SSH-користувач
- `HETZNER_SSH_KEY` — приватний SSH-ключ deploy-користувача
- `GITHUB_TOKEN` — авто (для GHCR)

### A2. Файл `.env` на сервері (поряд із `docker-compose.staging.yml`)

Compose читає `--env-file .env`. Заповни (staging):

**Обовʼязкові (compose впаде без них, `:?`):**

```
POSTGRES_PASSWORD_STAGING=<надійний пароль>
DATABASE_URL_STAGING=postgresql://workflo_stg:<той самий пароль>@postgres:5432/workflo_staging
JWT_SECRET_STAGING=<random ≥32 символи>
```

**🔴 Критично для Workspace — IP-whitelist:**

```
TEAM_IPS=<твій публічний IP>/32,<офіс/VPN CIDR>
```

> Дефолт `127.0.0.1/32` = ніхто ззовні не зайде у Workspace (Traefik `ipwhitelist`). **Без заповнення `TEAM_IPS` `dev-work.workflo.space` віддаватиме 403.** Кілька значень — через кому. Свій IP: `curl ifconfig.me`.

**Опційні (мають дефолти, заповни за потреби):**

```
POSTGRES_DB_STAGING=workflo_staging
POSTGRES_USER_STAGING=workflo_stg
TRAEFIK_NETWORK=traefik_network
TRAEFIK_CERT_RESOLVER=cf
CORS_ALLOWED_ORIGINS_STAGING=https://dev.workflo.space,https://dev-portal.workflo.space,https://dev-work.workflo.space
PORTAL_URL_STAGING=https://dev-portal.workflo.space
WORKSPACE_URL_STAGING=https://dev-work.workflo.space
COOKIE_DOMAIN=.workflo.space
SMTP_HOST=mail.workflo.space
SMTP_PORT=587
SMTP_USER=<...>
SMTP_PASS=<...>
BOT_TOKEN=<якщо бот>
OPENAI_API_KEY=<якщо AI>
SENTRY_DSN=<якщо Sentry>
```

### A3. DNS + TLS

- `dev-work.workflo.space` → A-запис на IP сервера (TLS-SAN на нього вже є в `landing` router).
- Traefik (cert-resolver `cf`) видасть Let's Encrypt-сертифікат автоматично.

### A4. API-URL (вже зашито в код, нічого вручну)

SPA звертається до API **cross-origin** за абсолютним `VITE_API_URL`, що **бейкається на білді** з `build-args` у CI:

- staging → `https://dev-api.workflo.space`
- production → `https://api.workflo.space`

> Це фікс із аудиту: раніше SPA кликали відносний `/api` без nginx-проксі → у проді не діставали API. Тепер CORS (`CORS_ALLOWED_ORIGINS_*`) + cookie-domain `.workflo.space` (refresh-cookie `Path=/auth/refresh`) працюють крос-доменно. Нічого додатково заповнювати не треба — лише переконайся, що `CORS_ALLOWED_ORIGINS_STAGING` містить `https://dev-work.workflo.space` (дефолт містить).

### A5. Seed тест-акаунтів + зразкових даних на staging БД

Міграції накочує `migrate`-сервіс автоматично. Seed — вручну (idempotent, можна перезапускати):

```bash
# на сервері, у каталозі /var/www/srv/workflo/staging:
export TAG=$(cat .last_deploy)
docker compose --project-name workflo-staging --env-file .env -f docker-compose.staging.yml \
  run --rm -e API_TAG=$TAG api pnpm --filter @workflo/db seed
```

> ⚠️ `API_TAG=$(cat .last_deploy)` обовʼязково — інакше compose візьме плейсхолдер `sha-initial`
> (образу нема в GHCR → `not found`). `-e SEED_OWNER_PASSWORD='…'` — опційно, свій пароль власника.

Дефолтні акаунти: `owner@workflo.space / Admin123!`, `executor@workflo.space / Exec123!`, `client@example.com / Client123!`.

**Seed також кладе зразкові дані (S5/S5.6), щоб фін/design-v2-екрани були не порожні:**
3 послуги · 2 фін-проєкти (абонплата $300/міс + погодинка $35/год) · 3 витрати (P&L/donut) ·
2-га компанія «ТОВ Партнер» (приведена тест-компанією) + реферал + бонус $25 на гаманець.
Усе guard-нуте `count()` → повторний seed нічого не дублює. **Платежі/нарахування/moneyBalance НЕ
сідяться** (money-інваріанти) — створюються через UI (Рахунки → згенерувати → підтвердити).

---

## B. Перевірка збірки/старту на сервері

1. **Деплой:** пуш у гілку staging → GitHub Actions «Staging» зелений (build matrix 5/5 + deploy).
2. **Контейнери:** `docker ps` — `workflo-workspace` (Up), `api` (healthy), `postgres` (healthy).
3. **Health:** `curl -I https://dev-work.workflo.space/health` (з whitelisted-IP) → `200 ok`.
4. **TLS:** сертифікат не «TRAEFIK DEFAULT CERT» (CI це чекає для portal; для work перевір вручну в браузері).
5. **IP-whitelist:** з **не**-whitelisted IP (моб. інтернет/VPN off) → `dev-work.workflo.space` має дати **403**. З whitelisted → відкривається `/login`.
6. **API-зв'язок:** на `/login` відкрий DevTools → Network; логін шле запит на `https://dev-api.workflo.space/auth/login` (а не на 404 same-origin).

---

## C. Функціональний план тестування (manual, на staging)

Легенда: ☐ крок. Бек-гейти (розділ D) — НЕ баги.

### C0. Доступ / ізоляція ролей

- ☐ Клієнт `client@example.com` входить на `dev-work` → екран **«Немає доступу до кабінету команди»** + кнопка «Вийти».
- ☐ Не-whitelisted IP → 403 (Traefik), сторінка не вантажиться зовсім.
- ☐ Owner входить → бачить full-nav (Огляд/Замовлення/Клієнти/Команда/Налаштування).
- ☐ Executor входить → бачить вузький nav (Мої задачі/Профіль/Налаштування).
- ☐ Executor вручну відкриває `/orders`, `/clients`, `/team` → редірект на `/` (RoleRoute).

### C1. Auth (S4-01)

- ☐ Login owner/executor: правильні креди → вхід; невірний пароль → помилка під полем.
- ☐ `/forgot-password` → лист у поштовій скриньці; таймер resend 47с.
- ☐ `/reset-password?token=…` → новий пароль (strength-meter), логін новим паролем.
- ☐ Hard-reload залогіненим → сесія відновлюється (refresh-cookie cross-origin працює). _Якщо ні — дивись A4/CORS._
- ☐ Owner `/team` → інвайт виконавця по email → лист прилітає; повторний той самий email не плодить дублі.
- ☐ Executor відкриває `/invite/:token` (з листа) під своїм email → «Приєднатися до команди» → після прийняття потрапляє у Workspace як executor.
- ☐ Відкрити **company_member**-токен на `dev-work/invite/:token` → екран «Це запрошення для клієнтського порталу» (не приймається). _(фікс аудиту)_

### C2. Executor — задачі (S4-02)

- ☐ `/` (Мої задачі): kanban лише з призначених executor-у замовлень; колонки Нові/Оцінка/В роботі/Рев'ю/Пауза; stat-плитки зверху.
- ☐ Картка → Enter/Space з клавіатури відкриває `/orders/:id` (a11y).
- ☐ `/orders/:id`: header (№, клієнт, статус, дедлайн, оцінка, лог годин); таби Чат/Файли/Час.
- ☐ **Чат:** надіслати повідомлення; **🔒 internal**-тоглом — внутрішня нотатка (підсвічена, з 🔒); live-оновлення (відкрий той самий order у Порталі клієнтом — звичайні (не-internal) повідомлення видно, internal — ні).
- ☐ **Файли:** drag-drop/вибір → завантаження; download; видалення (лише свого).
- ☐ **Час:** додати запис (години/дата/коментар); сума годин у заголовку; видалити свій запис.
- ☐ **Статус:** dropdown пропонує лише дозволені переходи; зміна статусу → toast + оновлення дошки; (за наявності) system-коментар у чаті підтягується.

### C3. Owner — огляд і замовлення (S4-04, S4-05)

- ☐ `/` (Огляд): stat-плитки (нових/в роботі/рев'ю/завершено); «потребують уваги» (прострочені, без виконавця); дошка всіх замовлень.
- ☐ `/orders`: перемикач **Дошка↔Таблиця**; пошук по назві (debounce); якщо >100 — рядок «показано перші 100 з N».
- ☐ Клік/Enter по рядку таблиці або картці → `/orders/:id`.
- ☐ Owner у деталі: ті самі таби + зміна статусу (повний набір переходів).

### C4. Owner — клієнти (S4-06)

- ☐ `/clients`: список компаній (derived з замовлень), активних/усього/сума; банер «профілі — з S5».
- ☐ Рядок → `/clients/:id`: назва компанії (з деталі замовлення), stat-плитки, таблиця замовлень компанії → клік у `/orders/:id`.

### C5. Executor — профіль (S4-03)

- ☐ `/profile`: обліковий запис (імʼя/email/роль); секція «Заробіток — скоро (S5)».

### C6. Дрібниці / регресії

- ☐ Перемикач мови UK/EN у топбарі (поки переважно UA-хардкод — повний i18n = S4-07b).
- ☐ Logout із футера sidebar → на `/login`.
- ☐ Portal (`dev-portal`) НЕ зламаний цим релізом (швидкий smoke: login клієнта, список замовлень).

---

## D. Відомі бек-гейти (НЕ репортити як баги — чекають S5)

- **Заробіток виконавця** (`/profile`) — ставки/виплати = ExecutorRate/payout API (S5).
- **Призначення виконавця** з UI деталі замовлення — потрібен members-list API (S5). Зараз assign недоступний у UI (хоча бекенд-ендпойнт є).
- **Назви/rich-профілі клієнтів у списку** `/clients` — повний clients-модуль 28 (S5). Назва зʼявляється лише на `/clients/:id` (з деталі замовлення).
- **Самостійна реєстрація** запрошеного виконавця без акаунта — register нині створює owner+компанію; окремий auth-таск.
- **i18n EN** — більшість екранів UA-хардкод (S4-07b, Block 7b).
- **Mobile/responsive** Workspace — окремі mobile-екрани дизайну, відкладено (S9+).
- **Пагінація** списків (>100) — повна пагінація = S10 (зараз показуємо перші 100 + підказку).

---

## E. Підсумок аудиту S4 (2026-06-08)

- **Регресій:** 0 (нові `apps/workspace`-файли + additive infra; спільні пакети не чіпані; гейт 21/21·13/13·18/18).
- **Декомпозиція:** здорова, split не потрібен.
- **Дизайн-відповідність:** ~95%; усі вжиті `.wfp-*` класи валідні.
- **Виправлено:** 10 код-пунктів (a11y, SSE-guard, invite-type, типи, exhaustiveness, …) + критичний інфра-фікс `VITE_API_URL` (cross-origin прод).
