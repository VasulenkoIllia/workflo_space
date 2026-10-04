# CRON JOBS — Заплановані задачі

> Зведений список всіх автоматичних задач системи.
> Версія: 1.1 | Оновлено: 11 червня 2026 (S5.5 AR-60 — звірка з реальністю)

---

## ⚠️ СТАН ФАКТУ (11.06.2026) vs план нижче

Таблиця нижче — **квітневий ПЛАН**, не стан коду (аудит AR-60). Фактично:

**Реально працює (всі — plain `setTimeout`/`setInterval` у `apps/api/src/cron/`, БЕЗ
`node-cron`; стартують через `startWorkers()` — inline або worker-контейнер, ADR-006):**

| Що                                              | Розклад                                                         | Файл                          |
| ----------------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| НБУ курс USD/UAH (C01)                          | щодня 06:10 UTC                                                 | `cron/exchangeRate.ts`        |
| Recurring charges (C02, Node а НЕ pg_cron)      | щомісяця                                                        | `cron/recurringCharges.ts`    |
| Loyalty tier recalc (C16)                       | щодня                                                           | `cron/loyaltyRecalc.ts`       |
| Refresh-token sweep (S5.5)                      | щодня 03:50 UTC                                                 | `cron/refreshTokenSweep.ts`   |
| Outbox drain (не cron — фоновий loop)           | кожні 5 c                                                       | `services/outboxWorker.ts`    |
| Email-inbound полер (S12-05)                    | кожні ~2 хв — лише якщо задані `INBOUND_IMAP_*`                 | `cron/inboundEmail.ts`        |
| Daily DB backup + offsite-обвʼязка              | щодня 03:00 UTC — інсталюється `scripts/install-backup-cron.sh` | `scripts/backup.sh`           |
| Notify digest (S12-06)                          | щогодини, при 8-й годині Kyiv шле дайджест                      | `cron/notifyDigest.ts`        |
| Timer auto-stop (C15)                           | щогодини (~1 хв після старту, далі щогодини)                    | `cron/timerAutoStop.ts`       |
| Calendar reminder (S24)                         | кожні 15 хв (вікно 45–60 хв до зустрічі)                        | `cron/calendarReminder.ts`    |
| Dunning payment reminders (C-dunning)           | щогодини (batch-обробка нарахувань)                             | `cron/dunning.ts`             |
| Client monthly report (C-client_monthly_report) | щодня (зведення за попередній місяц)                            | `cron/clientMonthlyReport.ts` |
| Monthly report (C-monthly_report, S11)          | щодня (зведення за попередній місяц)                            | `cron/monthlyReport.ts`       |
| SLA check (S10-02)                              | кожні 15 хв                                                     | `cron/slaCheck.ts`            |
| Credentials rotation reminder (S17-D)           | щодня (daily sweep, reminder через rotationRemindedAt)          | `cron/credentialsRotation.ts` |
| Idempotency key sweep (S6)                      | щодня 03:50 UTC                                                 | `cron/idempotencyKeySweep.ts` |

**Новіші розширення (план на S8+):** pg_cron-джоби (C02/C05/C06/C17 — extension
увімкнено, джоби не створені) · `dueDateReminder`/`cleanupFiles`/`subscriptionExpiry`/
`overdueEscalation`/`retentionPurge`/`heartbeatCheck` · `disk-check.sh`/`uploads-backup.sh`.
Створюючи будь-який — онови ЦЮ секцію.

---

## Огляд (план)

Два типи cron в системі:

- **pg_cron** (PostgreSQL extension) — для задач що напряму працюють з БД (підписки, очищення)
- **Node.js cron** в `apps/api/src/cron/` — для задач з зовнішніми API (НБУ, Telegram). As-built: plain-таймери, без `node-cron`.

---

## Всі задачі

| ID  | Назва                                     | Тип     | Розклад            | Timezone | Файл                                                 |
| --- | ----------------------------------------- | ------- | ------------------ | -------- | ---------------------------------------------------- |
| C01 | Оновлення курсу USD/UAH                   | Node.js | щодня 09:10        | Kyiv     | `cron/exchangeRate.ts`                               |
| C02 | Recurring charges (підписки)              | pg_cron | 1-го числа 00:01   | UTC      | `pg_cron SQL`                                        |
| C03 | Нагадування про дедлайни                  | Node.js | щодня 09:00        | Kyiv     | `cron/dueDateReminder.ts`                            |
| C04 | Очищення файлів (soft deleted)            | Node.js | щодня 03:00        | UTC      | `cron/cleanupFiles.ts`                               |
| C05 | Очищення OTP токенів                      | pg_cron | щогодини           | UTC      | `pg_cron SQL`                                        |
| C06 | Expire запрошень (invites)                | pg_cron | щодня 00:00        | UTC      | `pg_cron SQL`                                        |
| C07 | Нагадування про закінчення підписки       | Node.js | щодня 10:00        | Kyiv     | `cron/subscriptionExpiry.ts`                         |
| C08 | Моніторинг дискового простору             | Bash    | щодня 08:00        | UTC      | `scripts/disk-check.sh`                              |
| C13 | Backup uploads (rsync + GPG → Hetzner)    | Bash    | щодня 04:00        | UTC      | `scripts/uploads-backup.sh`                          |
| C15 | Auto-stop забутих таймерів (8h)           | Node.js | кожні 5 хв         | UTC      | `cron/timerAutoStop.ts`                              |
| C16 | Loyalty recalc + overdue escalation       | Node.js | 02:30 + кожні 30хв | UTC      | `cron/loyaltyRecalc.ts`, `cron/overdueEscalation.ts` |
| C17 | Refresh revenue_monthly_mv                | pg_cron | щодня 02:00        | UTC      | `pg_cron SQL`                                        |
| C18 | Retention purge (anonymize + hard delete) | Node.js | щодня 03:00        | UTC      | `cron/retentionPurge.ts`                             |
| C19 | Cron heartbeat check (alerting)           | Node.js | кожні 30 хв        | UTC      | `cron/heartbeatCheck.ts`                             |

---

## Детальний опис

### C01 — Оновлення курсу USD/UAH

```typescript
// apps/api/src/cron/exchangeRate.ts
// Щодня о 09:10 Kyiv (НБУ публікує курс о 09:00)
cron.schedule(
  '10 6 * * *',
  async () => {
    // 06:10 UTC = 09:10 Kyiv
    try {
      const response = await fetch(
        'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json'
      )
      const [data] = await response.json()
      // data.rate — курс UAH за 1 USD

      await prisma.exchangeRate.upsert({
        where: { currency: 'UAH' },
        update: { rateToUsd: data.rate, updatedAt: new Date(), source: 'nbu_api' },
        create: { currency: 'UAH', rateToUsd: data.rate, source: 'nbu_api' },
      })
      logger.info({ rate: data.rate }, 'Exchange rate updated')
    } catch (error) {
      // Fallback: залишаємо останній відомий курс
      logger.warn({ err: error }, 'Exchange rate update failed — using last known rate')
      // НЕ кидаємо помилку — сервіс продовжує працювати зі старим курсом
    }
  },
  { timezone: 'UTC' }
)
```

**Fallback:** якщо НБУ API недоступний — система продовжує працювати з останнім збереженим курсом. Якщо курс не оновлювався більше 3 днів — owner отримує Telegram сповіщення.

---

### C02 — Recurring charges (підписки)

```sql
-- Виконується через pg_cron (встановлюється при ініціалізації БД)
-- Кожного 1-го числа місяця о 00:01 UTC

SELECT cron.schedule(
  'monthly-subscriptions',
  '1 0 1 * *',
  $$
    INSERT INTO payments (company_id, amount, type, status, description, created_at)
    SELECT
      s.company_id,
      s.price_usd,
      'subscription',
      'pending',
      'Щомісячна оплата: ' || s.name,
      NOW()
    FROM services s
    JOIN company_subscriptions cs ON cs.service_id = s.id
    WHERE s.is_recurring = true
      AND cs.is_active = true
      AND cs.next_charge_date <= NOW()
    ON CONFLICT DO NOTHING;

    -- Оновлюємо дату наступного списання
    UPDATE company_subscriptions
    SET next_charge_date = next_charge_date + INTERVAL '1 month'
    WHERE is_active = true
      AND next_charge_date <= NOW();
  $$
);
```

**Після виконання:** cron job в Node.js перевіряє нові `pending` payments і надсилає нотифікації клієнтам.

---

### C03 — Нагадування про дедлайни

```typescript
// apps/api/src/cron/dueDateReminder.ts
// Щодня о 09:00 Kyiv
cron.schedule(
  '0 6 * * *',
  async () => {
    // 06:00 UTC = 09:00 Kyiv
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const orders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['done', 'cancelled'] },
        dueDate: {
          gte: new Date(),
          lte: new Date(tomorrow.setHours(23, 59, 59)),
        },
      },
      include: {
        executors: { include: { user: true } },
        company: true,
      },
    })

    for (const order of orders) {
      const isToday = order.dueDate!.toDateString() === new Date().toDateString()
      const message = isToday
        ? `⚠️ Дедлайн СЬОГОДНІ: "${order.title}"`
        : `📅 Дедлайн ЗАВТРА: "${order.title}"`

      for (const executor of order.executors) {
        await notify(executor.userId, 'order.due_soon', { orderId: order.id, message })
      }
    }
  },
  { timezone: 'UTC' }
)
```

---

### C04 — Очищення soft-deleted файлів

```typescript
// apps/api/src/cron/cleanupFiles.ts
// Щодня о 03:00 UTC
cron.schedule('0 3 * * *', async () => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7) // 7 днів після видалення

  const files = await prisma.fileAttachment.findMany({
    where: {
      deletedAt: { lte: cutoff },
    },
    select: { id: true, storagePath: true },
  })

  let deleted = 0
  for (const file of files) {
    try {
      await storage.delete(file.storagePath)
      await prisma.fileAttachment.delete({ where: { id: file.id } })
      deleted++
    } catch (error) {
      logger.error({ err: error, fileId: file.id }, 'Failed to delete file')
    }
  }

  logger.info({ deleted, total: files.length }, 'File cleanup completed')
})
```

---

### C05 — Очищення OTP токенів

```sql
-- pg_cron: щогодини
SELECT cron.schedule(
  'cleanup-otp-tokens',
  '0 * * * *',
  $$
    DELETE FROM otp_tokens
    WHERE expires_at < NOW() - INTERVAL '1 hour'
      OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '24 hours');
  $$
);
```

---

### C06 — Expire запрошень

```sql
-- pg_cron: щодня о 00:00 UTC
SELECT cron.schedule(
  'expire-invites',
  '0 0 * * *',
  $$
    UPDATE invites
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();
  $$
);
```

---

### C07 — Нагадування про закінчення підписки

```typescript
// apps/api/src/cron/subscriptionExpiry.ts
// Щодня о 10:00 Kyiv (07:00 UTC)
cron.schedule(
  '0 7 * * *',
  async () => {
    // За 7 днів до закінчення
    const in7Days = new Date()
    in7Days.setDate(in7Days.getDate() + 7)

    const expiring = await prisma.companySubscription.findMany({
      where: {
        isActive: true,
        nextChargeDate: {
          gte: new Date(),
          lte: in7Days,
        },
      },
      include: { company: { include: { members: { where: { role: 'owner' } } } }, service: true },
    })

    for (const sub of expiring) {
      const companyOwner = sub.company.members[0]
      if (!companyOwner) continue
      await notify(companyOwner.profileId, 'subscription.expiring', {
        serviceName: sub.service.name,
        expiresAt: sub.nextChargeDate,
      })
    }
  },
  { timezone: 'UTC' }
)
```

---

### C08 — Моніторинг дискового простору

```bash
#!/bin/bash
# scripts/disk-check.sh — запускається через host crontab
# Crontab: 0 8 * * * /srv/workflo/scripts/disk-check.sh

THRESHOLD=85  # % використання
USAGE=$(df /srv/workflo/uploads | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_DEPLOY_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_DEPLOY_CHAT_ID}" \
    -d "text=⚠️ Disk space alert: uploads volume ${USAGE}% full on $(hostname)"
fi
```

---

## Ініціалізація pg_cron

```sql
-- Виконується один раз при налаштуванні сервера
-- Після встановлення PostgreSQL + pg_cron extension

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Перевірити заплановані задачі:
SELECT * FROM cron.job;

-- Видалити задачу:
SELECT cron.unschedule('monthly-subscriptions');
```

---

## Node.js cron ініціалізація

```typescript
// apps/api/src/cron/index.ts — реєструємо всі cron jobs при старті API
export async function initCronJobs() {
  if (process.env.NODE_ENV === 'test') return // не запускаємо в тестах

  await import('./exchangeRate')
  await import('./dueDateReminder')
  await import('./cleanupFiles')
  await import('./subscriptionExpiry')

  logger.info('Cron jobs initialized')
}

// apps/api/src/index.ts
await initCronJobs()
```

---

## Моніторинг виконання

Кожен cron job логує результат:

```
info: Exchange rate updated { rate: 41.5 }
info: Due date reminders sent { count: 3 }
info: File cleanup completed { deleted: 12, total: 14 }
info: Subscription expiry notifications sent { count: 2 }
```

Якщо cron job завершується з помилкою → `logger.error` → Sentry захоплює автоматично.

---

## S1 alignment update (нові cron jobs)

### C02 — Recurring charges (уточнення)

Раніше планувалось `1-го числа 00:01`. Уточнено: configurable day of month per subscription (1 / 15 / last). Cron запускається **щодня 00:30** і обробляє тільки subscriptions де `next_invoice_at <= now()`.

Idempotency: lock через `cron_runs.metadata.processed_ids` — повторний запуск skip-ить уже processed subscriptions. Створює `Document(type='invoice')` + `ServiceCharge` + `notify(event='billing.invoice_sent')`. Деталі — `05-billing.md → Auto-invoicing flow`.

### C07 — Invoice overdue marker

Розширено: окрім нагадування про закінчення підписки, ставить `service_charges.status = 'overdue'` де `due_date < now() AND status = 'pending'`. Для кожного нового overdue → `notify(event='billing.invoice_overdue')` до company owner.

### C13 — Uploads backup

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC=/var/lib/workflo/uploads
DEST=/backup/uploads
rsync -a --delete "$SRC/" "$DEST/"
# weekly compress + encrypt
if [ "$(date +%u)" = "7" ]; then
  TAR=/tmp/uploads-$(date +%F).tar.gz
  tar czf "$TAR" -C /backup uploads
  gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /etc/workflo/backup.key "$TAR"
  rclone copy "$TAR.gpg" hetzner:workflo-backups/uploads/
  rm -f "$TAR" "$TAR.gpg"
fi
```

### C15 — Timer auto-stop

Кожні 5 хв: знаходить `time_logs WHERE ended_at IS NULL AND started_at < now() - INTERVAL '8 hours'` → ставить `ended_at = started_at + 8h`, `auto_stopped=true`, `auto_stop_reason='timeout'`. Notification executor'у про auto-stop. Деталі — `02-orders.md → Time tracking`.

### C16 — Loyalty recalc + overdue escalation

Два under-один-ID jobs:

- **02:30 daily** — `loyaltyRecalc.ts`: перераховує tier кожної company за lifetime paid USD. Tier upgrade → `notify(event='loyalty.tier_upgraded')`. Tier ніколи не downgrade автоматично. Деталі — `10-loyalty.md`.
- **кожні 30 хв** — `overdueEscalation.ts`: orders де `deadline < now()` і немає transition в done за 4 год → `notify(event='orders.overdue')` owner'у. Деталі — `07-notifications.md → Escalation`.

### C17 — Refresh revenue_monthly_mv

```sql
SELECT cron.schedule('refresh_revenue_mv', '0 2 * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_monthly_mv;
$$);
```

Materialized view для `19-reports.md → Revenue Report` heavy aggregation.

### C18 — Retention purge

Повна специфікація — `RETENTION.md → Cron C18`. Послідовність: anonymize stage → soft-to-hard-delete stage → TTL-purge stage → storage purge stage → report. Окремий DB connection з 30s statement timeout. Alert через C19 heartbeat при 3 consecutive failures.

### C19 — Heartbeat check (alerting)

Кожні 30 хв: для кожного active cron job перевіряє наявність свіжого successful `cron_runs` row у межах `2 × expected_interval`. Відсутність → PagerDuty + Slack `#alerts`. Деталі — `21-system-monitoring.md → Heartbeat для cron`.

### Cron heartbeat table

Всі Node.js cron jobs пишуть `cron_runs` row на старті (`status='running'`) + апдейт на завершенні (`success`/`failed` + `durationMs`). Schema — `20-admin-settings.md → секція 6`.
