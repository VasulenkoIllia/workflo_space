# LANDING PAGE MODULE

> ⚠️ **Канон БД — `packages/db/prisma/schema.prisma`; статус готовності — `TRACKER.md`.** `model {}`-блоки в цьому доку = дизайн-намір модуля: якщо різняться зі схемою, істина у схемі (а не тут).

> App: Landing (workflo.space)
> Статус: MVP
> Залежить від: `packages/ui`, `packages/i18n`
> Оновлено: 12 квітня 2026

---

## Огляд

Маркетинговий лендинг для залучення клієнтів. Next.js 15 App Router з SSR/ISR, мультимовність (UA/EN через URL), SEO-оптимізований. Немає авторизації — публічний доступ.

---

## Технічний стек

| Компонент | Рішення                                                |
| --------- | ------------------------------------------------------ |
| Framework | Next.js 15 (App Router)                                |
| Rendering | SSG/ISR (blog) + SSR (landing sections з dynamic data) |
| Styles    | Tailwind CSS 4, darkMode: class                        |
| i18n      | next-intl (URL-based: /uk/, /en/)                      |
| SEO       | next/metadata API                                      |
| Analytics | (Phase 2)                                              |

---

## Структура сторінок

```
workflo.space/
├── /                      → redirect → /uk/
├── /uk/                   → Головна (UA)
├── /en/                   → Головна (EN)
├── /uk/blog               → Блог (ISR)
├── /uk/blog/[slug]        → Стаття (ISR)
├── /en/blog               → Blog (EN)
├── /uk/pricing            → Ціни
├── /uk/terms              → Умови використання
├── /uk/privacy            → Політика конфіденційності
├── /en/terms              → Terms of Service
├── /en/privacy            → Privacy Policy
├── /uk/about              → Про нас (Phase 2)
└── /api/revalidate        → Internal ISR endpoint
```

---

## Маршрутизація i18n (next-intl)

```
apps/landing/src/app/
├── [locale]/
│   ├── layout.tsx         // locale layout з NextIntlClientProvider
│   ├── page.tsx           // Головна
│   ├── blog/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   └── pricing/page.tsx
└── api/
    └── revalidate/route.ts
```

### middleware.ts

```typescript
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['uk', 'en'],
  defaultLocale: 'uk',
  localePrefix: 'always', // /uk/... та /en/...
})

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

---

## Секції головної сторінки

### 1. Hero Section

- Заголовок: "Автоматизуй свій бізнес. Делегуй задачі. Ростіть разом."
- Підзаголовок: короткий опис що робить Workflo.Space
- CTA кнопки: "Спробувати безкоштовно" → `portal.workflo.space/register` + "Дізнатися більше" → anchor scroll
- Фоновий animated gradient або ілюстрація

### 2. Features Section

- 6 ключових переваг (іконки + текст):
  - Замовлення під контролем
  - Прозора комунікація
  - Документи автоматично
  - Реальний час статусів
  - Лояльність і бонуси
  - Реферальна програма

### 3. How It Works

- 3 кроки: Реєстрація → Перше замовлення → Отримай результат
- Анімовані ілюстрації (Lottie або CSS)

### 4. Pricing Section

- 3 тарифи (з billing module):
  - Starter, Professional, Business
  - Перемикач USD/UAH (курс з API)
  - CTA: "Почати" для кожного плану
- Dynamic data з API (ISR або SSR)

### 5. Testimonials (Phase 2)

- Відгуки клієнтів

### 6. Blog Preview

- Останні 3 статті з блогу (ISR)
- "Читати всі статті" → /uk/blog

### 7. CTA Section

- Повторний заклик до реєстрації
- Референс на реферальну програму

### 8. Footer

- Лого, короткий опис
- Навігація: Blog, Pricing, About
- Соцмережі
- Мовний перемикач (uk/en)
- © 2026 Workflo.Space

---

## SEO

### Metadata (кожна сторінка)

```typescript
// apps/landing/src/app/[locale]/layout.tsx
export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  return {
    metadataBase: new URL('https://workflo.space'),
    title: {
      default: 'Workflo.Space — Автоматизація бізнесу',
      template: '%s | Workflo.Space',
    },
    description: 'Платформа для управління замовленнями, командою та документами.',
    openGraph: {
      type: 'website',
      locale: locale === 'uk' ? 'uk_UA' : 'en_US',
      url: 'https://workflo.space',
      siteName: 'Workflo.Space',
    },
    robots: { index: true, follow: true },
    alternates: {
      languages: { uk: '/uk', en: '/en' },
    },
  }
}
```

### Sitemap

```typescript
// apps/landing/src/app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetch(`${API_URL}/blog?status=published&limit=100`).then((r) => r.json())

  const staticPages = [
    { url: 'https://workflo.space/uk/', priority: 1.0 },
    { url: 'https://workflo.space/en/', priority: 0.9 },
    { url: 'https://workflo.space/uk/pricing', priority: 0.8 },
    { url: 'https://workflo.space/uk/blog', priority: 0.8 },
  ]

  const blogPages = posts.items.flatMap((post: any) => [
    { url: `https://workflo.space/uk/blog/${post.slug}`, priority: 0.7 },
    { url: `https://workflo.space/en/blog/${post.slug}`, priority: 0.6 },
  ])

  return [...staticPages, ...blogPages]
}
```

### robots.txt

```typescript
// apps/landing/src/app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://workflo.space/sitemap.xml',
  }
}
```

---

## Мовний перемикач

```tsx
// apps/landing/src/components/LanguageSwitcher.tsx
'use client'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const switchLocale = (newLocale: string) => {
    // Замінюємо /uk/ на /en/ в URL
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => switchLocale('uk')} className={locale === 'uk' ? 'font-bold' : ''}>
        UA
      </button>
      <span>|</span>
      <button onClick={() => switchLocale('en')} className={locale === 'en' ? 'font-bold' : ''}>
        EN
      </button>
    </div>
  )
}
```

---

## Тема (Dark/Light)

На лендингу тема визначається системними налаштуваннями (`prefers-color-scheme`). Перемикач теми (опційно) — зберігається в localStorage.

```tsx
// apps/landing/src/app/[locale]/layout.tsx
<html lang={locale} suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{
      __html: `
        const theme = localStorage.getItem('theme') || 'system'
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        }
      `
    }} />
  </head>
```

---

## Переклади (next-intl)

```
packages/i18n/src/
├── uk/
│   ├── landing.json
│   └── common.json
└── en/
    ├── landing.json
    └── common.json
```

```json
// landing.json (uk)
{
  "hero": {
    "title": "Автоматизуй свій бізнес. Делегуй задачі. Ростіть разом.",
    "subtitle": "Платформа для управління замовленнями та командою.",
    "cta_primary": "Спробувати безкоштовно",
    "cta_secondary": "Дізнатися більше"
  },
  "pricing": {
    "monthly": "На місяць",
    "annual": "На рік",
    "save": "Економте 20%"
  }
}
```

---

## Pricing Page — динамічні дані

```tsx
// apps/landing/src/app/[locale]/pricing/page.tsx
// Revalidate кожні 10 хвилин (тарифи змінюються рідко)
export const revalidate = 600

async function getPlans() {
  const res = await fetch(`${process.env.API_URL}/billing/plans`, {
    next: { revalidate: 600 },
  })
  return res.json()
}

export default async function PricingPage({ params: { locale } }: Props) {
  const plans = await getPlans()
  const t = await getTranslations({ locale, namespace: 'pricing' })
  // ...
}
```

---

## Performance

| Метрика    | Ціль                |
| ---------- | ------------------- |
| LCP        | < 2.5s              |
| CLS        | < 0.1               |
| FID/INP    | < 200ms             |
| Lighthouse | > 90 all categories |

**Оптимізації:**

- `next/image` для всіх зображень (автоматичний WebP, lazy loading)
- Мінімум client-side JS (більшість компонентів — Server Components)
- Font: `next/font/google` (Inter або Geist) — self-hosted, no layout shift
- SVG іконки — inline (no HTTP requests)

---

## Nginx конфігурація (Docker)

```nginx
# apps/landing/nginx.conf
server {
  listen 80;

  location / {
    proxy_pass http://landing:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Статика кешується
  location /_next/static/ {
    proxy_pass http://landing:3000;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

---

## Зв'язки з іншими модулями

| Модуль       | Зв'язок                                      |
| ------------ | -------------------------------------------- |
| **Blog**     | ISR blog posts, on-demand revalidation       |
| **Billing**  | Pricing section тягне плани з API            |
| **Auth**     | CTA кнопки ведуть на Portal register         |
| **Referral** | Реєстрація з referral code передається в URL |

---

## Аудит-фіналізація (30 травня 2026) — reconcile + нові фічі

### A. Обов'язкові reconcile

**Документувати contact-form** (зараз не описана!) + спам-захист: Cloudflare Turnstile + honeypot + `ContactForm.{ipAddress, status, captchaScore}` + disposable-domain block + body-cap. API-down → graceful ISR fallback (try/catch + stale cache). Locale-switcher — anchor на провідний сегмент (не `replace` перший збіг). `POST /api/contact` → notify owner (event `system.contact_received`). Sitemap — реальний blog API (`published` bool, пагінація).

### B. Cookie consent / GDPR ✅

- Consent-банер (EU/UA) + consent-gated аналітика (GA/Plausible вантажиться лише після згоди). `ConsentLog` (опц.). Cookie-policy сторінка.

### C. Редагований контент (CMS) ✅

- `LandingContent { id, agencyId, block(hero|services|cases|pricing|faq|cta), contentJson, locale, updatedBy }`. Owner редагує блоки лендінгу без деплою (Workspace `/admin/landing`). Per-agency (white-label лендінг при multi-agency).

### D. Live-chat / віджет ✅

- Віджет онлайн-запиту/чату → створює lead (`ContactForm`) або support-тикет (модуль 14↔support). Real-time через наявний SSE/WebSocket. Notify owner.

```
ContactForm: + ipAddress, status, captchaScore, agencyId
New: LandingContent, ConsentLog
```

---

## Прохід власника (11.06.2026) — прийняті розширення

> Рішення власника з повного проходу модулів (канон: `MODULE_REVIEW_2026-06.md`).
> Ця секція авторитетна нарівні з «Аудит-фіналізація»; реалізація — за TRACKER-репланом.

| ID   | Рішення                                                                                                                          | Вплив                  | Нюанси власника                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| 14-В | **«Забронювати дзвінок» на лендингу** — інтеграція booking-links (модуль 24, S13-03) у CTA сайту                                 | [екран] (бек у S13-03) | Відповідь власника «б» інтерпретовано позиційно як 2-й пункт = В-бронювання |
| 14-Г | **Відгуки + логотипи клієнтів** — Testimonial CRUD у Workspace → блок лендингу; опційно запит відгуку після закритого замовлення | [бек+екран дрібний]    | —                                                                           |
| 14-Ж | **Аналітика власного лендингу** — GA4/Plausible + події-цілі (форма, бронювання)                                                 | [конфіг+події]         | —                                                                           |

**Відхилено:** А (калькулятор/квіз оцінки), Д (лід-магніти).

**Для ТЗ дизайнеру:** блок відгуків/логотипів (Г); CTA-блок бронювання дзвінка (В).
