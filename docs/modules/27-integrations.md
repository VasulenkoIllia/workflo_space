# INTEGRATIONS MODULE (inbound лідів + outbound webhooks + адаптери)

> 🗺️ **Реальний стан коду цього модуля — [`../DESIGN_COVERAGE.md`](../DESIGN_COVERAGE.md).** Позначки `✅`/`РЕЮЗ`/«готово» у цьому файлі = **дизайн/специфікація**, НЕ «в продакшені» (наскрізний аудит 2026-06-22).

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: API (+ Workspace settings UI) · Залежить від: **outbox** (доставка), **26-leads** (inbound → Lead), `ApiKey`/`WebhookEndpoint` (раніше згадані в 20-admin).
> Статус: **Спец** · Створено: 1.06.2026 · Модуль **27** (новий, окремий блок — важлива складова системи).
> Консолідує розкидане: inbound `ContactForm` (14), `ApiKey` + `WebhookEndpoint`/`WebhookDelivery` (20) → **єдиний інтеграційний хаб**, що розвивається поетапно.

---

## 0. Навіщо окремий модуль

Інтеграції — стратегічна складова: ліди приходять із багатьох каналів, а стани/статуси треба віддавати в зовнішні системи агенції. Замість «по шматочку в кожному модулі» — **один хаб** із чистим **adapter-патерном** (як Storage/Payment), щоб додавати канали поетапно, не чіпаючи ядро. Усе **per-agency** (white-label SaaS): кожна агенція підключає свої інтеграції у воркспейсі.

Три напрями:

1. **Inbound** — зовнішні джерела → `Lead` (форма сайту, месенджери, соцмережі).
2. **Outbound** — наші події (зміни станів/статусів) → зовнішні сервіси (webhooks).
3. **Public API** — агенція/її клієнт читають/пишуть через `ApiKey`.

---

## 1. Адаптер-патерн (ядро)

```
LeadSourceAdapter (normalize → Lead)            WebhookDispatcher (event → external)
  ├─ WebsiteFormAdapter   (POST /v1/leads)        ├─ через OUTBOX (retry/DLQ, topic #2-3)
  ├─ TelegramAdapter      (bot, модуль 15)         ├─ HMAC підпис X-Workflo-Signature
  ├─ MetaAdapter          (IG/FB/WhatsApp)         └─ per-agency WebhookEndpoint
  ├─ TikTokAdapter        (Lead Gen API)
  └─ EmailAdapter         (inbound email→lead)
```

Кожен inbound-адаптер: приймає webhook/запит каналу → валідує підпис каналу → **нормалізує** в `Lead` (`source` + `sourceDetail` + контакт + message + `rawPayload`) → створює лід у дефолт-воронці агенції → notify. Новий канал = новий адаптер, нуль змін у воронці.

---

## 2. Inbound: Lead Intake API (форма клієнта)

**Сценарій:** агенція дає **своєму клієнту/собі** ендпоінт + `ApiKey`, той «прикручує» свою веб-форму → звернення падає в воронку.

```
POST /v1/leads                       (публічний, поза JWT)
Authorization: Bearer <agency ApiKey>
{ "name", "email", "phone", "message",
  "source": "website_form",
  "sourceDetail": { "utm_source": "...", "page": "..." } }
→ 201 { leadId }
```

- **Auth:** `ApiKey` агенції (Bearer-шлях поряд із JWT) → визначає `agencyId` + scope `leads:write`.
- **Спам/захист:** rate-limit per-ApiKey, honeypot-поле, опц. Cloudflare Turnstile token, disposable-domain block, body-cap (як 14-landing ContactForm).
- **Ідемпотентність:** опц. `Idempotency-Key` header → не дублювати при ретраях форми.
- **CORS:** дозволені origin'и per-ApiKey (агенція вказує домен(и) своєї форми).
- Маппиться в `Lead(source=website_form)`. `ContactForm` лендингу workflo — окремий випадок цього ж шляху (`source=website_form`, agency=platform).
- **Phase 2:** hosted embeddable widget (JS-сніпет `<script src=".../embed.js" data-key="...">`) — готова форма без бекенду клієнта.

---

## 3. Inbound: месенджери / соцмережі

Кожен — окремий адаптер + webhook-receiver, нормалізує → `Lead`:

| Канал                    | Механізм                                                              | Фаза   |
| ------------------------ | --------------------------------------------------------------------- | ------ |
| **Telegram**             | наявний бот (15) — `/start` від нового контакту / повідомлення → lead | **P1** |
| **Instagram / Facebook** | Meta Graph API — **Lead Ads** webhook + Messenger webhook             | P2     |
| **WhatsApp**             | Meta WhatsApp Business API (або Twilio) — inbound message webhook     | P2     |
| **TikTok**               | TikTok Lead Generation API                                            | P2     |
| **Email**                | inbound email→lead (08-email inbound, post-MVP)                       | P2     |

Спільне: `IntegrationConnection { id, agencyId, provider, config(Json, токени/secret), isActive }` (per-agency OAuth/токени) + webhook-роут `POST /integrations/:provider/webhook` із верифікацією підпису провайдера + dedup (update-id, як telegram). `sourceDetail` фіксує канал/handle/adId.

---

## 4. Outbound: Webhooks (зміни станів/статусів → зовнішні сервіси)

> **Мінімум, який треба зараз** (запит власника). Будується на наявному **outbox + drain-воркері** (вже є).

```prisma
model WebhookEndpoint {
  id        String   @id @default(uuid())
  agencyId  String
  url       String
  events    String[] // order.created, order.status_changed, payment.confirmed, lead.created, ...
  secret    String   // для HMAC
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  @@index([agencyId])
  @@map("webhook_endpoints")
}
model WebhookDelivery {
  id          String   @id @default(uuid())
  endpointId  String
  event       String
  payload     Json
  status      String   // pending | delivered | failed | dead
  attempts    Int      @default(0)
  responseCode Int?
  lastError   String?
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  @@index([endpointId, status])
  @@map("webhook_deliveries")
}
```

**Логіка:**

1. Доменна подія (вже enqueue-иться в outbox: `order.status_changed` ✅ є) → outbox-handler `webhook.fanout` знаходить активні `WebhookEndpoint`, підписані на цю подію в цій агенції → створює `WebhookDelivery` + enqueue `webhook.deliver`.
2. `webhook.deliver` handler: POST на `endpoint.url` з тілом події + заголовком **`X-Workflo-Signature: hmac-sha256(secret, body)`** + `X-Workflo-Event`. Успіх (2xx) → delivered; інакше → retry через outbox-backoff → DLQ (`dead`).
3. Підписник перевіряє HMAC → довіряє. Агенція інтегрує Zapier/Make/власний бекенд/CRM.

> Це **той самий outbox-механізм**, що вже драйнить нотифікації (BE-OBX) — webhooks = ще один handler-type. Нічого нового в інфрі.

**Події (стартовий набір):** `order.created`, `order.status_changed`, `payment.confirmed`, `lead.created`, `lead.converted`, `document.issued`.

---

## 5. Public API + ApiKey

```prisma
model ApiKey {
  id         String    @id @default(uuid())
  agencyId   String
  name       String
  hashedKey  String    @unique   // зберігаємо лише hash; plaintext показуємо 1 раз
  scopes     String[]  // leads:write, orders:read, webhooks:manage, ...
  expiresAt  DateTime? @db.Timestamptz(3)
  lastUsedAt DateTime? @db.Timestamptz(3)
  revokedAt  DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)
  @@index([agencyId])
  @@map("api_keys")
}
```

- Bearer-auth-шлях (поряд із JWT): `Authorization: Bearer wf_live_...` → lookup по hash → `agencyId` + scopes → `can()` зі scope-перевіркою.
- Inbound Lead API (§2) + майбутній public read/write API (orders/leads) — обидва через ApiKey.
- Плейн-ключ — лише раз при створенні; ротація; `lastUsedAt` для аудиту.

---

## 6. Налаштування (Workspace UI — у фронтенд-прохід)

Воркспейс `/settings/integrations` (розширення 20-admin):

- **API-ключі:** список, створити (показати раз), scope, revoke.
- **Inbound-форма:** ключ + дозволені домени + сніпет/інструкція для клієнтової форми + журнал останніх лідів.
- **Канали:** підключити Telegram/Meta/TikTok (OAuth/токени) → `IntegrationConnection`.
- **Outbound webhooks:** додати endpoint (url + події + secret), журнал `WebhookDelivery` (статус/повтори), тест-надсилання.

Усе per-agency → частина white-label SaaS-конфігу (SAAS_CONFIG.md).

---

## 7. Фази (поетапність)

- **Phase 1 — Integrations MVP (перша фаза):**
  1. **Inbound Lead API** `POST /v1/leads` + `ApiKey` (форма клієнта на сайт).
  2. **Telegram** як джерело лідів (бот уже є).
  3. **Outbound webhooks** (`WebhookEndpoint`/`Delivery` через outbox + HMAC) — зміни статусів назовні.
     → Це закриває «мінімум» власника: форма клієнта + наші webhooks для станів.
- **Phase 2 — соц-канали:** Meta (Instagram/Facebook Lead Ads + Messenger), WhatsApp, TikTok, embeddable widget, inbound email→lead.
- **Phase 3 — SaaS-маркетплейс:** каталог інтеграцій, per-agency OAuth-конект, two-way sync (CRM/Zapier/Make app), public API v1 (повний).

---

## 8. SaaS-вписування

- Усе scoped по `agencyId`: `ApiKey`, `WebhookEndpoint`, `IntegrationConnection`, ліди.
- Кожна агенція налаштовує **свої** інтеграції у воркспейсі (білий лейбл).
- Підписка/ліміти: к-сть інтеграцій/webhook-endpoints/ApiKey — через `featureEnabled`/quota-seam (SAAS.md F2) на тарифі агенції.
- Платформний рівень: super-admin бачить інтеграційну активність агенцій (Phase 3).

---

## 9. Звʼязок з іншими модулями

- **26-leads** — inbound-адаптери створюють `Lead`; outbound `lead.created`/`lead.converted`.
- **outbox (07/S1.6)** — транспорт outbound webhooks (drain-воркер уже є).
- **15-bot** — Telegram inbound-адаптер.
- **14-landing** — `ContactForm` = `website_form`-джерело через цей же шлях.
- **20-admin / 13-settings** — UI налаштувань (ключі/webhooks/канали).
- **05-billing** — `payment.confirmed` як webhook-подія; PaymentProvider webhooks (inbound оплати) — суміжний, але окремий (05).

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                                                                                                                                                                                                                                                                  | Вплив             | Нюанси власника                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------- |
| 27-А | **Публічне API v1 + OpenAPI/Swagger** (генерація з наявних Zod-схем) — піднято з беклогу                                                                                                                                                                                                                                 | [бек]             | «так робимо»                     |
| 27-Б | **Slack/Discord нотифікації** — закладка (адаптер), низький пріоритет                                                                                                                                                                                                                                                    | [бек] дрібний     | «не критично але закласти можна» |
| 27-В | **⭐ Карта вебхуків системи** (завдання-аналіз до фінального плану): інвентаризувати ВСІ доменні події системи → які стають вихідними вебхуками; які дії доступні через вхідні вебхуки/API; розширити документацію використання вебхуків для інтеграцій. «Виділити, що ми в системі можемо робити за допомогою вебхуків» | [аналіз+бек+доки] | формулювання власника — канон    |

**Лишається SaaS-фаза:** Г (Zapier/Make конектор — після публічного API).
