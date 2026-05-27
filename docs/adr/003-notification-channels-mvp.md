# ADR-003: Notification Channels Strategy для MVP

**Статус:** Прийнято
**Дата:** 17 квітня 2026
**Контекст:** S1 notifications — потрібно зафіксувати, які канали підтримуються в MVP, які з них доступні per-user, а які заблоковані для критичних подій.

---

## Контекст

Workflo.space надсилає нотифікації за 7 категоріями × 6 каналами (детально див. `docs/modules/07-notifications.md`):

**Категорії:** auth, orders, chat, billing, documents, loyalty, system
**Канали:** email, telegram, in_app, sms, push, webhook

Не всі канали готові на MVP. Не для всіх подій можна давати користувачам свободу вибору каналу — деякі події (auth, billing) є **юридично/безпеково критичними** і мають доставлятися гарантовано.

## Розглянуті варіанти доступності каналів

### A. Всі 6 каналів увімкнені на MVP
- **Contra:** SMS = $$$ (Twilio/SMSC), push = потрібен PWA / native app, webhook = enterprise feature. Не варто розпиляти focus.

### B. Email-only на MVP
- **Contra:** клієнти Telegram-first аудиторії (~60% за CONCEPT_v2), email буде ігноруватись.

### C. Email + Telegram + in_app на MVP (sms/push/webhook — registry-ready, але disabled) ✅
- **Pro:**
  - покриває реальні юзкейси (email для legal/billing, telegram для real-time, in_app для UI badges),
  - SMS/push/webhook — registered у `CHANNELS` registry але `enabled: false` (готові до S6+),
  - resolver автоматично пропускає disabled канали — нуль refactor коли вмикаємо.
- **Contra:** Telegram потребує bot setup (S6 task #11 спершу).

## Рішення (канали)

Обрано варіант **C**. Канали готові у MVP: `email`, `telegram`, `in_app`. Решта (`sms`, `push`, `webhook`) — registered, disabled.

## Розглянуті варіанти політики критичних подій

### A. Користувач керує всім — навіть auth events можна вимкнути
- **Contra:** Користувач вимикає password_reset email → не може відновити доступ до аккаунту. Юридичні наслідки.

### B. Hard-lock усіх категорій (no user preferences) — все надсилається завжди
- **Contra:** Користувач, який не хоче spam про `loyalty.tier_upgraded` чи `orders.status_changed`, страждає. Conversion drop.

### C. Critical events lock — auth+billing завжди email (НЕ можна вимкнути), решта — preferences ✅
- **Pro:**
  - юридично/безпеково критичні події гарантовано доставляються (`auth.password_reset`, `billing.invoice_sent`, `billing.payment_failed`),
  - користувач має повний контроль над non-critical (orders, chat, documents, loyalty, system),
  - lock працює навіть якщо `NotificationPreference` каже `enabled: false` (resolver ігнорує preference для critical events на email).
- **Contra:** Користувач не може вимкнути ці email. Документуємо це чітко в `/profile/settings/notifications`.

## Рішення (critical events)

Обрано варіант **C**. Список critical events (always email):

```typescript
// packages/types/src/enums.ts
export const CRITICAL_EVENTS: ReadonlyArray<NotificationEvent> = [
  // auth — потрібен для відновлення доступу
  'auth.password_reset',
  'auth.email_verification',
  'auth.login_from_new_device',

  // billing — юридично/фінансово критичні
  'billing.invoice_sent',
  'billing.invoice_paid',
  'billing.invoice_overdue',
  'billing.payment_failed',
  'billing.refund_issued',
];
```

## Резолюція каналу (resolver logic)

```typescript
// packages/notifications/src/resolver.ts (спрощено)
export async function resolveTargetChannels(
  prisma: PrismaClient,
  settingsId: string,
  event: NotificationEvent
): Promise<ReadonlyArray<NotificationChannel>> {
  const category = EVENT_TO_CATEGORY[event];

  // 1. Critical events: завжди email + те, що увімкнено
  if (CRITICAL_EVENTS.includes(event)) {
    const prefs = await prisma.notificationPreference.findMany({
      where: { settingsId, category, enabled: true, channel: { in: ['telegram', 'in_app'] } },
    });
    return ['email', ...prefs.map((p) => p.channel)];
  }

  // 2. Non-critical: лише увімкнені user'ом
  const prefs = await prisma.notificationPreference.findMany({
    where: { settingsId, category, enabled: true },
  });
  return prefs.map((p) => p.channel).filter((c) => CHANNELS[c]?.enabled);
}
```

## CHANNELS registry

```typescript
// packages/notifications/src/channels.ts
export const CHANNELS = {
  email:    { enabled: true,  cost: 'low',    requiresUserOptIn: false },
  telegram: { enabled: true,  cost: 'low',    requiresUserOptIn: true  }, // потрібен /start у боті
  in_app:   { enabled: true,  cost: 'free',   requiresUserOptIn: false },
  sms:      { enabled: false, cost: 'high',   requiresUserOptIn: true  }, // S7+
  push:     { enabled: false, cost: 'free',   requiresUserOptIn: true  }, // PWA / native — S8+
  webhook:  { enabled: false, cost: 'free',   requiresUserOptIn: true  }, // enterprise — TBD
} as const;
```

## Telegram opt-in flow

- Користувач створює аккаунт через portal/landing → отримує welcome email з deep link `https://t.me/workflo_bot?start=<verification_code>`.
- Telegram bot (`/start <code>`) → API verifies → save `telegramChatId` у `notification_settings`.
- Після цього user може у `/profile/settings/notifications` увімкнути канал `telegram` для будь-якої категорії.
- Якщо bot заблокований користувачем → adapter повертає `{ status: 'blocked' }` → resolver автоматично disable's channel preference (єдине auto-disable у системі).

## Anti-spam: rollup

Якщо у `notification_log` ≥ 3 події одного типу для одного `settingsId` за останні 10 секунд:
- надсилається 1 rollup message замість N окремих,
- решта events маркуються `rollup_target_id` для трасування.

Деталі rollup — у `docs/modules/07-notifications.md` секція "Anti-spam".

## Наслідки

- **MVP scope чіткий:** 3 канали, не намагаємось зробити SMS у S1.
- **User trust:** критичні події гарантовано доходять; non-critical можна вимкнути.
- **Forward-compatible:** додавання SMS = тільки enable у registry + написання SmsAdapter.
- **Audit:** кожен dispatch логується у `notification_log` з `delivery_status`.

## Перегляд

Переглянути коли:
- з'явиться enterprise клієнт, який вимагає webhook,
- буде вирішено зробити mobile app (push),
- з'являться скарги на blocked critical email delivery.
