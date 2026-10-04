# ADR-001: Refresh Token Cookie Strategy

**Статус:** Прийнято
**Дата:** 17 квітня 2026
**Контекст:** Auth модуль S1 — потрібно обрати стратегію зберігання refresh token.

---

## Контекст

Workflo.space має три фронтенди (landing, portal, workspace) і API на окремому домені.
Refresh token (30d TTL) має:
- бути недоступним з JS (захист від XSS),
- передаватись лише на `/auth/refresh` (мінімізація поверхні атаки),
- працювати з CSRF guard,
- пережити навігації між поддоменами проєкту.

## Розглянуті варіанти

### A. `SameSite=Strict; Path=/`
- **Pro:** найсильніший захист від CSRF.
- **Contra:** ламає flow коли користувач переходить з landing → portal/workspace по зовнішньому посиланню (cookie не надсилається на перший cross-site GET). Refresh не спрацьовує до hard reload.

### B. `SameSite=Strict; Path=/auth/refresh`
- **Pro:** мінімальна поверхня (cookie тільки на refresh).
- **Contra:** ті самі cross-site навігаційні проблеми, що й (A).

### C. `SameSite=Lax; Path=/` ✗
- **Pro:** працює при cross-site навігації.
- **Contra:** cookie шириться на всі шляхи API → збільшує поверхню атаки, кожен `/orders/*` запит несе refresh token.

### D. `SameSite=Lax; Path=/auth/refresh` ✅
- **Pro:**
  - cookie доступний при top-level GET-навігаціях (cross-site лінки працюють),
  - cookie передається тільки на `/auth/refresh` — мінімізована поверхня,
  - інші endpoints (`/orders/*`, `/files/*`, etc.) refresh не отримують.
- **Contra:** CSRF протекція трохи слабша, ніж Strict, але:
  - `/auth/refresh` приймає тільки POST,
  - тіло не використовується (тільки cookie + Origin check),
  - access token guard у відповіді короткий (15m TTL).

## Рішення

Обрано варіант **D**: `SameSite=Lax; Path=/auth/refresh`.

Додатково:
- `HttpOnly=true` (заборона JS-доступу),
- `Secure=true` у staging/production (HTTPS-only),
- `Secure=false` у dev (Mailpit + HTTP),
- `Domain=.workflo.space` у staging/production (shared між поддоменами),
- `Domain=undefined` у dev (localhost specific).

Access token (15m TTL) — у пам'яті браузера (state manager), ніколи не в localStorage / cookies.

## Cookie konfiguracja (Fastify)

```typescript
reply.setCookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: env.NODE_ENV !== 'development',
  sameSite: 'lax',
  path: '/auth/refresh',
  domain: env.COOKIE_DOMAIN, // .workflo.space у prod, undefined у dev
  maxAge: 30 * 24 * 60 * 60, // 30 днів у секундах
  signed: false,             // токен сам є JWT, sign не потрібен
});
```

## CSRF Guard для `/auth/refresh`

```typescript
fastify.post('/auth/refresh', {
  preHandler: async (req, reply) => {
    const origin = req.headers.origin;
    const allowed = [env.APP_LANDING_URL, env.APP_PORTAL_URL, env.APP_WORKSPACE_URL];
    if (!origin || !allowed.includes(origin)) {
      return reply.code(403).send({ error: 'invalid_origin' });
    }
  },
}, handler);
```

## Наслідки

- **Cross-site cookie sharing** працює коректно: landing → portal зберігає сесію.
- **CSRF risk** обмежений тільки на `/auth/refresh` (1 endpoint), захищений Origin-check.
- **XSS risk** для refresh token нульовий (HttpOnly).
- **Logout** обов'язково має чистити cookie на тому ж шляху:
  ```typescript
  reply.clearCookie('refresh_token', { path: '/auth/refresh', domain: env.COOKIE_DOMAIN });
  ```

## Перегляд

Переглянути коли:
- з'явиться нова цільова платформа (mobile app, native client),
- буде впроваджено native CSRF token rotation,
- виявиться security incident, пов'язаний з refresh token theft.
