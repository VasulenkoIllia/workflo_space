# ADR-006: Extraction Seams & Web/Worker Split

**Статус:** Прийнято · **Дата:** 1 червня 2026
**Контекст:** ADR-005 фіксує моноліт. Але 90% користі мікросервісів можна отримати за 10% ціни — через **процес/пакет-екстракцію в тому ж репо/БД**, без мережевих меж. Питання: що виділити ЗАРАЗ (дешево), щоб майбутня екстракція була «флипом», а не переписуванням.

---

## Рішення

### Три рівні екстракції

- **Пакет** (логічна межа) — `packages/*`. Вже добре.
- **Процес/воркер** (операційна межа, той самий образ+БД) — закладаємо ЗАРАЗ.
- **Сервіс** (мережева межа) — НЕ зараз (ADR-005).

### Що закласти зараз (дешево, структурно)

1. **Web/Worker role-split одного образу.** Зараз `outboxWorker` + `chatListener` стартують у HTTP-процесі (`index.ts`). Винести воркер-bootstrap у `apps/api/src/worker.ts` з `startWorkers()`, керований env-флагом (`RUN_WORKERS_INLINE`): або в API-процесі (як зараз, single-replica), або окремий контейнер із тим самим образом, іншим CMD (`node dist/worker.js`). **Чому зараз:** при horizontal scale не можна мати N копій cron/drain-loop, що конкурують (подвійні нарахування/нотифікації) — треба 1 воркер. Ретрофіт після scale = переписувати bootstrap під тиском інциденту.
2. **Cron — через node-cron у воркері + outbox, НЕ pg_cron-SQL для бізнес-логіки.** SQL-у-cron невидимий для тестів/Sentry/типів, без доступу до notify/adapter-шару. pg_cron — лише планувальник, що enqueue-ить OutboxEvent (або node-cron у worker-процесі); логіка — у TS-handler'ах. Вести через `CronRun`-heartbeat.
3. **PDF (S6) + Webhook-delivery (27) + search-sync — outbox-handler-types через єдиний drain.** Інтерфейс `DocumentRenderer.render(doc): Promise<Buffer>`, виклик через async job `document.generate`. Коли PDF стане важким (Puppeteer/CPU) — виноситься в окремий worker-контейнер БЕЗ зміни викликів. Webhook = `case` у `buildDispatch()` поряд із notify.

### Seam-статус (перевірено)

- ✅ **Взірцеві:** `StorageAdapter`, `notify()` (structural-Prisma DI), `outbox` (FOR UPDATE SKIP LOCKED, lease, DLQ, multi-replica-safe), `chatBus`/`chatListener`.
- ⚠️ **`PaymentProvider` свідомо тонкий** (`confirmPayment` лише) — перепишеться в S5 (createIntent/handleWebhook/refund). Не вважати готовим seam'ом, але викликів мало → ОК.
- ✅ **Bot, Landing** — уже окремі процеси/контейнери. Правило: bot = тонкий transport над спільними пакетами, доменна логіка — у сервісах.

## Наслідки

- Web/worker split (~30 рядків + флаг) знімає найбільший операційний ризик horizontal scale.
- Drain стає єдиним механізмом для notify/webhook/pdf/search — нічого нового в інфрі.
- Екстракція в окремий сервіс (якщо колись) = змінити CMD/контейнер, не код.

## Звʼязок

ADR-005 (моноліт) · outbox (`services/outbox.ts`) · модуль 27 (webhooks) · 06-documents (PDF).
