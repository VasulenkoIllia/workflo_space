# CONTENT & BLOG MODULE

> App: Workspace (work.workflo.space) / Landing (workflo.space) / API (api.workflo.space) · Залежить від: `packages/db`, `packages/types`, **16-search**, **14-landing** (ISR).
> Статус: **REWRITE-done** (doc-sync 1.06) · Оновлено: 1 червня 2026
> ⚠️ Стара версія (Markdown-`content String`, `PostStatus` enum, `BlogTag`/`BlogPostTag` таблиці, плоскі SEO-поля) — **фікція**, видалена. Канон нижче.

---

## 0. Огляд

Блог на лендингу (`workflo.space/blog`) для SEO + демонстрації експертизи. Статті пишуться/AI-генеруються через workspace, рендеряться на лендингу через **Next.js ISR**. Модель **білінгва per-row**: один пост містить і `uk`, і `en` контент.

---

## 1. Реальна модель `BlogPost`

```prisma
model BlogPost {
  id          String       @id @default(uuid())
  slug        String       @unique
  type        BlogPostType @default(article)   // article | case_study
  titleUk     String
  titleEn     String
  excerptUk   String?
  excerptEn   String?
  contentUk   Json          // блочний контент (НЕ Markdown-рядок)
  contentEn   Json
  tags        String[]      // НЕ join-таблиці BlogTag/BlogPostTag
  authorId    String
  published   Boolean       @default(false)    // НЕ PostStatus enum
  featured    Boolean       @default(false)
  publishedAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  // ... author Profile @relation
}

enum BlogPostType { article case_study }
```

> **Чого НЕМАЄ (на відміну від старої фікції):** немає `content String` Markdown, `PostStatus(draft/published/archived)`, `BlogTag`/`BlogPostTag`, `language`-колонки (білінгва — в одному рядку), плоских `metaTitle/keywords`.
>
> **Заплановані колонки (Аудит-фіналізація C — ще не в схемі):** `metaTitleUk/En`, `metaDescriptionUk/En`, `ogImageUrl`, `canonicalUrl`, `coverImageUrl`, `aiModel`, `aiPromptVersion`, `agencyId`. Доти landing `generateMetadata` для SEO читає `undefined` — це відомий gap.

---

## 2. Життєвий цикл

- **Стан = два булеві:** `published` (видно на лендингу) + `featured` (промо-позиція). Немає `draft/published/archived`-машини.
- **Slug:** `slugify(titleUk, {locale:'uk', strict:true})`; колізія → суфікс `-2/-3…` **у транзакції** (race-safe).
- **Publish і Unpublish** обидва → ISR revalidate лендингу (publish — додає сторінку, unpublish — **прибирає**), **для обох локалей**.
- Усе agency-scoped (`agencyId`, коли додано) + **audit** на publish/unpublish; право `can('content.manage')`.

---

## 3. AI-генерація (Аудит-фіналізація B)

```
POST /blog/generate { topic, keywords?, type }   → GPT → draft (published=false)
```

- Gate: `can('content.manage')` + **per-agency квота `AgencyAiUsage`** + cost-guard.
- **Sanitize** `topic`/`keywords` (prompt-injection).
- Зберігати `aiModel` + `aiPromptVersion` (трасування).
- Owner редагує draft перед публікацією. Якщо `OPENAI_API_KEY` відсутній → кнопка генерації прихована (лише ручне написання).

System-prompt (референс): контент-менеджер Workflo для власників МСБ в Україні; структура H1+вступ+3-5×H2+висновок; 800-1200 слів; без кліше; мова за `type`/локаллю.

---

## 4. ISR (лендинг)

- API після publish/unpublish → `POST {LANDING_URL}/api/revalidate` (Bearer `NEXT_REVALIDATION_SECRET`) з `paths` для **обох локалей**.
- `generateStaticParams` — для **обох локалей** (не лише одна); `export const revalidate = 3600` як fallback.
- **Sitemap** — пагінований (без truncate на 100); **JSON-LD** Article; per-locale `alternates`.

---

## 5. Рендеринг і безпека

- `contentUk/En` — **JSON-блоки** → block-render на лендингу (не raw `react-markdown` на рядку).
- **`rehype-sanitize` обов'язково** скрізь, де рендериться збережений контент (stored-XSS) — навіть якщо в блоках є markdown.
- Workspace: блочний редактор + preview (split view) + AI-кнопка; список з фільтром `published`/`featured`.

---

## 6. API Endpoints

| Метод    | URL                 | Хто                    | Опис                                                               |
| -------- | ------------------- | ---------------------- | ------------------------------------------------------------------ |
| `GET`    | `/blog`             | Public + Workspace     | Список (public: лише `published`; фільтри `type`/`tag`/`featured`) |
| `GET`    | `/blog/:slug`       | Public + Workspace     | Пост за slug (обидві локалі)                                       |
| `POST`   | `/blog`             | Workspace              | Створити (`can('content.manage')`)                                 |
| `PATCH`  | `/blog/:id`         | Workspace              | Редагувати                                                         |
| `PATCH`  | `/blog/:id/publish` | Workspace              | `published` true/false → ISR revalidate + audit                    |
| `DELETE` | `/blog/:id`         | Workspace              | Видалити → ISR revalidate                                          |
| `POST`   | `/blog/generate`    | Workspace              | AI-генерація (§3)                                                  |
| `POST`   | `/api/revalidate`   | Internal (API→Landing) | On-demand ISR                                                      |

**DTO `POST /blog`:** `{ type, titleUk, titleEn, excerptUk?, excerptEn?, contentUk(JSON), contentEn(JSON), tags?[] }` (+ SEO-поля коли додані). `published`/`featured` — через `/publish`.

---

## 7. Зв'язки з іншими модулями

| Модуль         | Зв'язок                                               |
| -------------- | ----------------------------------------------------- |
| **14-landing** | ISR-рендер блогу на `workflo.space/blog` (per-locale) |
| **04-files**   | Обкладинка/`ogImage` — через Files                    |
| **01-auth**    | `authorId` → Profile                                  |
| **16-search**  | tsvector по `titleUk/En` + блочний текст              |

---

## Аудит-фіналізація (30 травня 2026) — REWRITE + нові фічі

> ⚠️ Стара частина **фікція** (Markdown content, PostStatus enum, BlogTag tables, SEO-поля) → ВИДАЛИТИ. Реальна `BlogPost`: `titleUk/En`, `excerptUk/En`, `contentUk/En` JSON (blocks), `tags String[]`, `published`+`featured` Boolean, `type BlogPostType{article,case_study}`. Білінгва per-row (uk+en в одному пості).

### A. Обов'язкові reconcile

Переписати схему/DTO/endpoints під реальну модель; slug-collision retry у транзакції; unpublish → ISR revalidate (прибрати сторінку); `generateStaticParams` для обох локалей; `rehype-sanitize` на `react-markdown`/JSON-render (stored-XSS!); `agencyId`; audit на publish/unpublish; `can('content.manage')`.

### B. AI-генерація статей ✅

- `POST /blog/generate { topic, keywords, type }` (GPT) → draft. Gate: `can()` + **per-agency quota** (`AgencyAiUsage`) + cost-guard. Sanitize topic/keywords (prompt-injection). Зберігати `model` + `promptVersion`. Owner редагує перед публікацією.

### C. SEO-інструменти ✅

- **Додати реальні SEO-поля** (зараз відсутні → landing `generateMetadata` читає undefined): `metaTitleUk/En`, `metaDescriptionUk/En`, `ogImageUrl`, `canonicalUrl`, `coverImageUrl`.
- Sitemap пагінація (не truncate на 100); JSON-LD structured data (Article); per-locale alternates.

```
BlogPost: + metaTitleUk/En, metaDescriptionUk/En, ogImageUrl, canonicalUrl, coverImageUrl, aiModel, aiPromptVersion, agencyId
New: AgencyAiUsage
```

> **→ BACKLOG (не обрано):** scheduled publishing (`publishedAt` future + cron).
