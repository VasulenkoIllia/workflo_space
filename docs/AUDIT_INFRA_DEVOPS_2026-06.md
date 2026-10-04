# Аудит інфраструктури / DevOps / серверної документації (2026-06-26)

> Цільовий аудит **тільки серверної частини**: CI/CD, контейнери/оркестрація, операційна
> стійкість (DR/бекапи/моніторинг), серверна документація. **4 паралельні агенти**, кожна
> high/critical-знахідка **крос-верифікована точково по коду/конфігах** (прямі читання
> `docker-compose.production.yml`, `.github/workflows/*`, `infra/*`, `scripts/*`). Жодне P0/P1
> не лишилося неперевіреним.
>
> **Диспозиція:** усе **відкладено в беклог** ([`BACKLOG.md` §Аудит інфра/DevOps](BACKLOG.md))
> з тригерами; у роботу зараз не береться (рішення власника 2026-06-26). Цей файл — повний
> запис знахідок + фазовий план на момент, коли беклог промоутнуть.

---

## Вердикт

**Механіка деплою — сучасна й зроблена добре; це НЕ «неправильно налаштовано».** Гейти на
реальному шляху доставки (не лише PR), backup-before-migrate fail-closed, авто-rollback на
проді з верифікованим tag-bookkeeping, health-gated `--wait`, non-root контейнери, сегментація
мереж, multi-stage SPA, GHA layer-cache — усе це **вище середнього** для single-host setup.

**Реальна прогалина — не в білд-пайплайні, а в операційній стійкості: disaster recovery,
бекапи, моніторинг.** Це **підтверджує й розгортає** топ-ризик «DR = нуль (CRITICAL)» з
[`AUDIT_FULL_2026-06.md`](AUDIT_FULL_2026-06.md) (11.06) — він досі відкритий. Для проекту, що
йде до зовнішніх платних тенантів, це найважливіше до закриття.

---

## ✅ Що реально добре (з доказами)

- **Гейти на справжньому шляху доставки** — `db` (real-PG: RLS-ізоляція + грошові інваріанти) +
  `smoke` (Playwright) блокують `build` через `needs` ([staging.yml:57-70](../.github/workflows/staging.yml), AR-01). Усі блокуючі, без `continue-on-error`.
- **Backup перед міграцією, fail-closed** — `pg_dump` падає або дамп <1024 байт → `exit 1`
  ([production.yml:244-258](../.github/workflows/production.yml), AR-03).
- **Авто-rollback на проді** — `verify` job `if: failure()` ре-деплоїть `prev_tag`; `.last_deploy`
  пишеться **лише після** успішного verify, тож `.previous_deploy` завжди безпечний (AR-05).
- **Health-gated деплой** — `compose up -d --wait --wait-timeout 180` замінив `compose ps`-grep,
  що пропускав crash-loop контейнери (AR-04); + post-deploy TLS-cert верифікація.
- **Контейнери:** non-root скрізь (`USER node` / `nginx-unprivileged`), manifests-first layer
  ordering (AR-50), `--frozen-lockfile`, ефективний `.dockerignore`, app-образи пінняться SHA-тегом.
- **Мережа:** Postgres лише на `app_network` (не назовні), api — єдиний міст edge↔data.
- **Секрети:** `${VAR:?}` fail-fast; нічого чутливого не закомічено (перевірено `git ls-files`).
- **Traefik:** dashboard за basicauth (AR-52), форс-HTTPS, Cloudflare DNS-01 wildcard-серти.
- **ADR:** 8 живих, датованих, з «Реалізовано»-амендментами (найкраще підтримувані доки в репо).
- **Пайплайн:** least-privilege `GITHUB_TOKEN`, serialized deploys (`concurrency`), pull-retry +
  Docker Hub auth проти rate-limit, `command_timeout: 20m` (2026-06-25).

---

## 🔴 P0 — Операційна стійкість / DR (головна прогалина)

| #        | Знахідка                                                                                                                                                                                                                      | Доказ (крос-верифіковано)                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **DR-a** | **Бекапи local-only.** Офсайт (restic/rclone) **закодований, але не активований** → дампи на тому ж диску, що Postgres. Втрата диска/хоста = втрата бекапів.                                                                  | `backup.sh` WARN-гілка активна; `INFRASTRUCTURE.md:1455` «RPO фактично 24h-local-only» |
| **DR-b** | **Restore ніколи не тестувався; `restore.sh` не існує** — backup-and-pray. `SLA.md` суперечливий («tested restore runbook» vs «untested»). Денні дампи без `--clean` → restore в населену БД зламається.                      | `ls scripts/` → немає restore; `SLA.md:18,27`                                          |
| **DR-c** | **Немає Infrastructure-as-Code** (0 Terraform/Ansible/cloud-init) — сервер «pet», pg_cron/cron-бекапів ставляться імперативно. Втрата хоста = ручна археологія з доків.                                                       | `find` → порожньо                                                                      |
| **DR-d** | **Завантажені файли не бекапляться І не змонтовані.** `STORAGE_TYPE="local"` дефолт + у prod-compose **немає volume для uploads** (лише `postgres_data`) → файли губляться при recreate контейнера, не лише при втраті хоста. | `docker-compose.production.yml:30-31,295`; `.env.example:71`                           |

> **Сукупно: втрата Hetzner-боксу сьогодні ≈ невідновлювана.** Реальний RPO = 24h (якщо диск
> вижив), RTO = невідомий (ніколи не вимірювався).

## 🟠 P1 — Спостережуваність (найбільша практична діра)

Failure-detection сьогодні = **«користувач напише нам»**:

- **Sentry вимкнено** — `SENTRY_DSN:-` дефолт порожній ([production.yml:184,239,259](../docker-compose.production.yml)).
- **Uptime / метрики / алерти — відсутні** (UptimeRobot/Netdata — чекбокси, не підняті; підтверджено `AUDIT_FULL:99`).
- **Деплой не нотифікує про падіння** — навіть провал авто-rollback'у тихий (BACKLOG OPS-D1).

## 🟠 P0/P1 — Безпека ланцюга постачання + edge

- **SEC-a (P0):** екшени на floating-тегах (`appleboy/ssh-action@v1`, `scp-action@v0.1.7`) — а вони
  тримають **prod SSH-ключ**. Ретег/компрометація = довільні команди на сервері. → пін на commit-SHA + Dependabot.
- **SEC-b (P1):** немає SSH host-key верифікації (TOFU) — вразливо до MITM/DNS-хайджаку `HETZNER_HOST`.
- **SEC-c (P1):** edge без security-headers — у `traefik.yml` **нема HSTS / X-Frame-Options / CSP /
  rateLimit** (лише cert+redirect); nginx SPA-конфіги теж без них. Немає явного `tls.options minVersion`.

## 🟡 P1/P2 — Менші діри стійкості / ефективності

- **OPS-a (P1):** staging **без rollback** (prod має, staging — ні) → застряглий staging блокує команду.
- **OPS-b (P2):** health-таргет `/health` (liveness), не `/ready` (DB) → API без БД пройде гейт. Дешевий фікс.
- **AR-50b (P2, уже в беклозі):** API-образ single-stage, тягне devDeps + Chromium + sources у
  runtime → роздутий pull. Потрібен dedicated migrate-stage + `pnpm deploy --prod`.
- **CI-D1 (P2, уже в беклозі):** білд без affected-фільтра — усі 5 образів щоразу (layer-cache
  пом'якшує). + немає promotion staging→prod (prod перебілджує з нуля, не той самий артефакт, що
  пройшов smoke; SPA не промоутиться через build-time `VITE_API_URL`).
- **P2-hardening:** контейнери без `no-new-privileges`/`cap_drop`/`read_only`; немає
  `HEALTHCHECK` в Dockerfile'ах; bot/worker без compose-healthcheck; бази на floating-тегах
  (не digest); Traefik access-log без ротації; docker.sock без socket-proxy.

## 📄 P1 — Документація (дрифт + прогалини)

- **INFRASTRUCTURE.md §5 застаріла на 2 покоління** — описує inline `docker run` міграції +
  runner-side backup; реально — `migrate` compose-сервіс + host-side blocking backup.
- **Мертві шляхи `infra/scripts/...`** у доках (5+ згадок) — каталогу **не існує**, канон у `scripts/`.
- **Немає incident-рунбуку** («деплой завис», «БД лежить», ротація секрету, severity/escalation).
- **Немає DR-доку** (rebuild сервера з нуля); RTO/RPO в `SLA.md` — аспіраційні (restore не існує).
- pg_cron у §7 суперечить ADR-006 (усі бізнес-крони — in-process `setTimeout`, pg_cron не юзається).
- **Немає ADR на топологію деплою** (single-host, sha-теги, SCP+SSH-compose, auto-rollback) — рішення
  живуть лише як `AR-0x` коментарі у воркфлоу.

---

## 📋 Фазовий план покращення (коли беклог промоутнуть)

| Фаза          | Зріз                                                                                               | Що дає                                            | Зусилля    |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| **1 (P0)**    | `restore.sh` + щомісячний restore-drill; активувати офсайт **restic**; змонтувати+бекапити uploads | RTO стає виміряним; дані переживають втрату боксу | ~1.5–2 дні |
| **2 (P0)**    | **IaC** (Ansible/cloud-init): Docker, Traefik, pg_cron, backup-cron, `.env`-скелет                 | Rebuild сервера за годину                         | ~1–2 дні   |
| **3 (P1)**    | Sentry on; UptimeRobot на `/ready`; **notify-on-failure** у деплой (через наш Telegram-бот)        | Дізнаємось про падіння раніше за клієнта          | ~1 день    |
| **4 (P0/P1)** | Пін екшенів на SHA + Dependabot + SSH-fingerprint; Traefik security-headers + rate-limit           | Supply-chain + clickjacking/abuse закрито         | ~0.5 дня   |
| **5 (P1)**    | Staging-rollback (портувати prod-патерн); health → `/ready`                                        | Staging не застрягає; гейт ловить БД-розрив       | ~0.5 дня   |
| **6 (P1/P2)** | Multi-stage API (AR-50b) + affected-білд-фільтр (CI-D1) + image-promotion                          | Менший pull, швидший деплой, ідентичний артефакт  | ~1–1.5 дня |
| **7 (P1)**    | `OPS_RUNBOOK.md` + `DISASTER_RECOVERY.md`; виправити §5-дрифт + мертві шляхи; ADR-009 топологія    | Хтось о 3-й ночі зможе відновити                  | ~1 день    |

**Рекомендований старт:** Фаза 1 (DR/бекапи) — єдине, де поточний стан = ризик незворотної
втрати даних. Решта важлива, але дані — насамперед. Тригер промоуту всього блоку: **перед
першим зовнішнім платним тенантом** (збігається з тригером SA-5 / OPS-D1).
