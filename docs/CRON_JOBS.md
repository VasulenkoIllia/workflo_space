# CRON JOBS — Заплановані задачі
> Зведений список всіх автоматичних задач системи.
> Версія: 1.0 | Оновлено: 12 квітня 2026

---

## Огляд

Два типи cron в системі:
- **pg_cron** (PostgreSQL extension) — для задач що напряму працюють з БД (підписки, очищення)
- **Node.js cron** (`node-cron`) в `apps/api/src/cron/` — для задач з зовнішніми API (НБУ, Telegram)

---

## Всі задачі

| ID | Назва | Тип | Розклад | Timezone | Файл |
|---|---|---|---|---|---|
| C01 | Оновлення курсу USD/UAH | Node.js | щодня 09:10 | Kyiv | `cron/exchangeRate.ts` |
| C02 | Recurring charges (підписки) | pg_cron | 1-го числа 00:01 | UTC | `pg_cron SQL` |
| C03 | Нагадування про дедлайни | Node.js | щодня 09:00 | Kyiv | `cron/dueDateReminder.ts` |
| C04 | Очищення файлів (soft deleted) | Node.js | щодня 03:00 | UTC | `cron/cleanupFiles.ts` |
| C05 | Очищення OTP токенів | pg_cron | щогодини | UTC | `pg_cron SQL` |
| C06 | Expire запрошень (invites) | pg_cron | щодня 00:00 | UTC | `pg_cron SQL` |
| C07 | Нагадування про закінчення підписки | Node.js | щодня 10:00 | Kyiv | `cron/subscriptionExpiry.ts` |
| C08 | Моніторинг дискового простору | Bash | щодня 08:00 | UTC | `scripts/disk-check.sh` |

---

## Детальний опис

### C01 — Оновлення курсу USD/UAH

```typescript
// apps/api/src/cron/exchangeRate.ts
// Щодня о 09:10 Kyiv (НБУ публікує курс о 09:00)
cron.schedule('10 6 * * *', async () => {  // 06:10 UTC = 09:10 Kyiv
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
}, { timezone: 'UTC' })
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
cron.schedule('0 6 * * *', async () => {  // 06:00 UTC = 09:00 Kyiv
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
}, { timezone: 'UTC' })
```

---

### C04 — Очищення soft-deleted файлів

```typescript
// apps/api/src/cron/cleanupFiles.ts
// Щодня о 03:00 UTC
cron.schedule('0 3 * * *', async () => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)  // 7 днів після видалення

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
cron.schedule('0 7 * * *', async () => {
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
}, { timezone: 'UTC' })
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
  if (process.env.NODE_ENV === 'test') return  // не запускаємо в тестах

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
