# WORKFLO.SPACE — SaaS Configuration (white-label: лендинг + портал + воркспейс)

> Статус: **Спец (авторитетний)** · Створено: 1 червня 2026
> Базується на: [`SAAS.md`](SAAS.md) (foundation/enablement), [`adr/004-multi-tenancy.md`](adr/004-multi-tenancy.md) (tenancy), [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) (токени).
> Рішення власника (1.06): **кожна агенція = повний white-label** — власний брендований **лендинг + портал клієнта + воркспейс**. `workflo.space` = маркетинг платформи (продаж workflo агенціям) + super-admin.
> Мета документа: описати **функції / логіку / екрани** конфігурування, щоб фронтенд будувався tenant-aware з першого рядка (інакше ретрофіт дорогий).

---

## 0. TL;DR — чому «в кінці» НЕ складно

1. **Дані конфігу вже tenant-ready** — усе per-agency scoped по `agencyId` (S1.6). Питання «де зберігати конфіг тенанта» вирішене.
2. **Брендинг = токени, не перемальовування.** Дизайн-система на свапабельних `--wf-*` (через `data-theme`/`data-accent`). Бренд агенції = набір значень токенів + лого + домен, які **інжектяться у рантаймі поверх готового UI**.
3. **Єдина дисципліна:** фронтенд будуємо на `--wf-*` токенах + читаємо `agency`-конфіг. Це не додаткова робота — це правильний спосіб (його диктує дизайн-система). Захардкодиш бренд workflo → ретрофіт болітиме.
4. Тому: **структурне (resolution + token-injection seam) — закладаємо у фронтенд-прохід із самого початку; продуктове (екрани-редактори, landing-CMS) — будуємо тоді ж, поверх tenant-ready даних.** Без переписування.

---

## 1. Чотири поверхні

| Поверхня                | Хост                                            | Хто бачить                 | Бренд   | Технологія                  |
| ----------------------- | ----------------------------------------------- | -------------------------- | ------- | --------------------------- |
| **Платформний лендинг** | `workflo.space`                                 | потенційні агенції         | workflo | Next.js (SEO)               |
| **Лендинг агенції**     | `acme.workflo.space` / custom domain            | потенційні клієнти агенції | агенції | Next.js (multi-tenant, SEO) |
| **Портал клієнта**      | `acme.workflo.space/app` (або `portal.acme...`) | клієнти агенції            | агенції | Vite SPA                    |
| **Воркспейс**           | `work.workflo.space` (per-tenant resolved)      | команда агенції            | агенції | Vite SPA                    |

> Точну схему доменів (sub-path vs subdomain для портал/лендинг) фіксуємо у Phase-1 інфра-рішенні (`BASE_DOMAIN` + Traefik wildcard — SAAS.md F5). Зараз — описова модель.

---

## 2. Логіка: як бренд тенанта потрапляє на екран

### 2.1 Host → tenant resolution (seam — SAAS.md F5)

1. Запит на `acme.workflo.space` → middleware дістає subdomain `acme` → `Agency.findUnique({ subdomain })` (або `customDomain`). → `agencyId` + бренд-конфіг.
2. Платформний хост (`workflo.space`) → особливий випадок (немає тенанта; маркетинг workflo).
3. Невідомий subdomain → 404 / редірект на платформу.

### 2.2 Token-injection (ключовий механізм)

- Бренд агенції зберігається як **набір значень `--wf-*`** (accent, опційні override нейтралей, лого, шрифт-пресет) + `data-accent`-пресет.
- **SSR-лендинг (Next):** резолвимо тенанта на сервері → інлайнимо `<style>:root{--wf-accent:…}</style>` + `data-theme`/`data-accent` у `<html>` → перший рендер уже брендований (без флешу).
- **SPA (портал/воркспейс):** на бутстрапі `GET /tenant/branding` (по хосту/сесії) → ставимо CSS-змінні на `:root` до першого paint (тонкий inline-скрипт у `index.html`, щоб уникнути FOUC).
- Лого/favicon/назва — з конфігу; усе інше (компоненти) **не знає про тенанта** — лише читає токени.

> Наслідок: додати нового тенанта з іншим брендом = рядок у БД + значення токенів. Нуль змін у компонентах.

---

## 3. Що конфігурується — по поверхнях (функції + екрани)

Усі екрани-редактори живуть у **Воркспейсі агенції** (розширення модуля 20 «Admin Settings»). Доступ — `isInternalTeam` + owner/admin-права.

### 3.1 Бренд (спільний для всіх поверхонь агенції)

**Функції:** лого (світле/темне), favicon, назва, accent-колір (пресет або кастом), тема за замовч. (light/dark), шрифт-пресет, опційні override нейтралей.
**Екран:** `Settings → Branding` — лайв-прев'ю (показуємо токени на семпл-компонентах), завантаження лого (storage, tenant-prefixed), вибір accent із палітри + кастом.
**Дані:** `Agency.branding Json?` (значення `--wf-*` + asset-ключі) — _Enablement_ (nullable-поле дешеве, але читає його фронтенд, тож додаємо разом із фічею).

### 3.2 Домен

**Функції:** subdomain (`acme`), custom domain (`app.acme.com`) + верифікація DNS + SSL-провіжн.
**Екран:** `Settings → Domain` — subdomain (валідація унікальності), custom domain (інструкція CNAME + статус верифікації).
**Дані:** `Agency.subdomain` / `customDomain` — ✅ **вже є** (FDN-1). Логіка верифікації/SSL — Enablement.

### 3.3 Лендинг агенції (CMS-lite — найбільший новий блок)

**Функції:** редагований контент маркетинг-сторінки: hero (заголовок/підзаголовок/CTA), блок послуг (з каталогу `services`), «про нас», відгуки, контакти/футер, SEO (title/description/OG-image). Публікація/чернетка.
**Екран:** `Settings → Landing` — секційний редактор (увімк/вимк секції, drag-order, поля контенту), прев'ю, кнопка «Опублікувати».
**Дані:** нова модель `AgencyLandingContent { agencyId, sections Json, seo Json, publishedAt }` — _Enablement_ (нова фіча; будується у фронтенд-прохід). Рендериться Next-лендингом по хосту з ISR.

### 3.4 Портал клієнта

**Функції:** привітальний текст/онбординг, видимі вкладки/фічі (toggle), контакти підтримки, бренд (успадковує §3.1).
**Екран:** `Settings → Client Portal` — welcome-копія, перемикачі фіч (через `featureEnabled`-seam, SAAS.md F2), контакт.
**Дані:** `Agency.portalConfig Json?` — _Enablement_.

### 3.5 Воркспейс (внутрішня робоча зона — більшість уже специфіковано в модулі 20)

**Функції:** відділи, сервіси-каталог, шаблони сповіщень, SMTP-сендер, нумерація документів, реферал-%, ставки/команда.
**Екрани:** наявні в модулі 20 (admin-settings) — будуються у фронтенд-прохід.
**Дані:** ✅ **вже tenant-ready** (`departments`/`services`/`notification_templates`/`smtp_senders`/`pdf_branding`/`referral_settings` scoped по `agencyId`).

---

## 4. Платформний рівень (super-admin) — Phase 1/2

`workflo.space` (платформний тенант) + super-admin-панель: список агенцій, suspend/resume, impersonate, перегляд підписок/usage, платформні метрики. + Agency signup/onboarding (`provisionAgency()` уже є — SAAS.md F3/E1). Підписка агенції на workflo (Stripe/Paddle — E2). Це Enablement E5/E1/E2.

---

## 5. Foundation (зараз / при фронтенді) vs Enablement (фіча-пас)

| Елемент                                                                                            | Коли                            | Чому                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `agencyId`-scoping усіх settings                                                                   | ✅ S1.6                         | done                                                 |
| `subdomain`/`customDomain` поля                                                                    | ✅ FDN-1                        | done                                                 |
| **Host→tenant resolution seam** + **token-injection seam** (inline `--wf-*` у SSR/SPA bootstrap)   | **на старті фронтенд-проходу**  | дешево закласти раз; ретрофіт у кожен екран — дорого |
| **Фронтенд на `--wf-*` токенах** (не хардкод)                                                      | **дисципліна фронтенд-проходу** | інакше per-tenant бренд = перемалювати все           |
| Branding/Landing/Portal **екрани-редактори** + моделі (`branding`/`landingContent`/`portalConfig`) | Enablement (фіча-пас)           | продуктове, поверх tenant-ready даних, без міграції  |
| Custom-domain верифікація/SSL, super-admin, підписка                                               | Phase 1 (кінець)                | продуктове                                           |

**Підсумок:** «в кінці» складно НЕ буде, якщо фронтенд-прохід **(а)** будується на токенах і **(б)** першими закладає resolution+injection seam. Решта (екрани-редактори, landing-CMS) — звичайна фіча-робота поверх готових tenant-scoped даних.

---

## 6. Що це означає для майбутнього фронтенд-проходу (чек-лист tenant-aware)

- [ ] `packages/ui` — усі компоненти лише на `--wf-*` токенах (нуль hex-хардкоду). _(перший крок UI-kit)_
- [ ] tokens.css — `--wf-*` (light/dark) + `data-accent`-пресети з `design/project/styles.css`.
- [ ] **Token-injection bootstrap:** SSR inline (Next-лендинг) + SPA pre-paint inline (portal/workspace) — ставить бренд тенанта до першого рендера.
- [ ] **Host→tenant resolver** (subdomain/customDomain → agencyId + branding) — API `GET /tenant/branding` + Next middleware.
- [ ] Лендинг (Next) — multi-tenant: рендерить контент агенції по хосту (ISR), платформний хост окремо.
- [ ] Екрани-редактори у воркспейсі: Branding / Domain / Landing / Client Portal (+ наявні module-20).
- [ ] Моделі `Agency.branding/portalConfig` + `AgencyLandingContent` — міграції разом із фічами (nullable, без ризику).

> Поки фронтенд відкладено (backend-first), цей документ — **ТЗ**, щоб коли дійдемо до UI, будувати одразу правильно.
