# CONTENT & BLOG MODULE
> App: Workspace (work.workflo.space) / Landing (workflo.space) / API (api.workflo.space)
> Статус: MVP
> Залежить від: `packages/db`, `packages/types`
> Оновлено: 12 квітня 2026

---

## Огляд

Блог на лендингу (workflo.space/blog) для SEO та демонстрації експертизи. Статті генеруються за допомогою AI (OpenAI GPT-4), публікуються через workspace, відображаються на лендингу за допомогою Next.js ISR (Incremental Static Regeneration).

---

## Пайплайн контенту

```
1. Owner відкриває "Новий пост" в workspace
2. Вводить тему/заголовок
3. Натискає "Згенерувати через AI" → API → OpenAI GPT-4 → Markdown текст
4. Owner редагує текст у textarea (raw Markdown)
5. Публікує → API встановлює status = 'published'
6. API викликає Next.js revalidation: revalidatePath('/blog') + revalidatePath(`/blog/${slug}`)
7. Лендинг оновлює статичні сторінки з нового контенту з БД
```

---

## AI Генерація

### Endpoint

```
POST /blog/generate
{
  topic: string          // тема статті
  keywords?: string[]    // ключові слова для SEO
  language?: 'uk' | 'en' // default: 'uk'
  tone?: 'professional' | 'friendly'  // default: 'professional'
}
```

### System Prompt

```
Ти контент-менеджер digital-агентства Workflo.Space, яке спеціалізується на автоматизації бізнес-процесів.
Пиши статті для блогу компанії у форматі Markdown.
Аудиторія: власники малого та середнього бізнесу в Україні.
Стиль: {{tone}}, зрозуміло, з практичними прикладами.
Довжина: 800-1200 слів.
Структура: заголовок (H1), вступ, 3-5 секцій (H2), висновок.
SEO: включи ключові слова {{keywords}} органічно.
Мова: {{language}}.
НЕ використовуй кліше типу "У світі, що швидко змінюється".
```

### OpenAI конфігурація

```typescript
// apps/api/src/routes/blog.ts
const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Напиши статтю про: ${topic}` }
  ],
  max_tokens: 2000,
  temperature: 0.7,
})
```

> `OPENAI_API_KEY` в ENV. Якщо ключ відсутній → кнопка "Згенерувати AI" прихована, тільки ручне написання.

---

## Статуси постів

```
draft → published
published → draft (зняти з публікації)
draft → archived
```

| Статус | Видно на лендингу |
|---|---|
| `draft` | ❌ |
| `published` | ✅ |
| `archived` | ❌ |

---

## SEO Поля

```prisma
model BlogPost {
  id              String   @id @default(uuid())
  title           String
  slug            String   @unique   // auto-generated: kebab-case(title)
  content         String   // Markdown
  excerpt         String?  // перші 160 символів або вручну
  coverImageUrl   String?  // URL зображення (завантажується через Files module)
  metaTitle       String?  // SEO title (якщо відрізняється від title)
  metaDescription String?  // SEO description, max 160 символів
  keywords        String[] // масив ключових слів
  language        String   @default("uk")  // 'uk' | 'en'
  status          PostStatus @default(draft)
  authorId        String
  publishedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  author Profile @relation(fields: [authorId], references: [id])
  tags   BlogPostTag[]

  @@index([status, publishedAt])
  @@index([language, status])
  @@index([slug])
}

model BlogTag {
  id    String @id @default(uuid())
  name  String @unique
  slug  String @unique
  posts BlogPostTag[]
}

model BlogPostTag {
  postId String
  tagId  String

  post BlogPost @relation(fields: [postId], references: [id])
  tag  BlogTag  @relation(fields: [tagId], references: [id])

  @@id([postId, tagId])
}

enum PostStatus {
  draft
  published
  archived
}
```

### Slug генерація

```typescript
// При збереженні поста
const slug = slugify(title, {
  lower: true,
  locale: 'uk',         // транслітерація з кирилиці
  strict: true,
  trim: true,
})
// Якщо slug вже існує → додаємо суфікс: -2, -3, ...
```

---

## ISR (Incremental Static Regeneration)

### При публікації поста

```typescript
// apps/api/src/routes/blog.ts — after status change to 'published'
const NEXT_REVALIDATION_SECRET = process.env.NEXT_REVALIDATION_SECRET
await fetch(`${process.env.LANDING_URL}/api/revalidate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${NEXT_REVALIDATION_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ paths: ['/blog', `/blog/${post.slug}`] }),
})
```

### Landing revalidation endpoint

```typescript
// apps/landing/src/app/api/revalidate/route.ts
export async function POST(request: Request) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.NEXT_REVALIDATION_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paths } = await request.json()
  for (const path of paths) {
    revalidatePath(path)
  }

  return Response.json({ revalidated: true })
}
```

### Static generation

```typescript
// apps/landing/src/app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch(`${API_URL}/blog?status=published&limit=100`).then(r => r.json())
  return posts.items.map((p: any) => ({ slug: p.slug }))
}

export const revalidate = 3600  // fallback: перегенерація кожну годину
```

---

## API Endpoints

| Метод | URL | Хто | Опис |
|---|---|---|---|
| `GET` | `/blog` | Public + Workspace | Список постів |
| `GET` | `/blog/:slug` | Public + Workspace | Пост за slug |
| `POST` | `/blog` | Workspace | Створити пост |
| `PATCH` | `/blog/:id` | Workspace | Редагувати пост |
| `PATCH` | `/blog/:id/status` | Workspace | Змінити статус (publish/unpublish) |
| `DELETE` | `/blog/:id` | Workspace | Видалити пост |
| `POST` | `/blog/generate` | Workspace | AI генерація контенту |
| `POST` | `/api/revalidate` | Internal (API→Landing) | On-demand ISR |

### Query для `GET /blog` (public)

```
language=uk|en
tag=automation
status=published    // public завжди тільки published
page=1
limit=10
```

### Query для `GET /blog` (workspace)

```
status=draft|published|archived
language=uk|en
page=1
limit=20
```

---

## DTO

### `POST /blog`

```typescript
{
  title: string
  content: string       // Markdown
  excerpt?: string
  coverImageUrl?: string
  metaTitle?: string
  metaDescription?: string
  keywords?: string[]
  language?: 'uk' | 'en'
  tagIds?: string[]
}
```

### BlogPost Response

```typescript
{
  id: string
  title: string
  slug: string
  content: string       // Markdown — frontend рендерить через react-markdown
  excerpt: string
  coverImageUrl: string | null
  metaTitle: string | null
  metaDescription: string | null
  keywords: string[]
  language: string
  status: PostStatus
  publishedAt: string | null
  author: { id: string; displayName: string; avatarUrl: string | null }
  tags: { id: string; name: string; slug: string }[]
  createdAt: string
  updatedAt: string
}
```

---

## Frontend — Landing (Next.js)

### Сторінки

- `/blog` — список постів, фільтр по тегах, пошук
- `/blog/[slug]` — стаття з SEO metadata (Open Graph, Twitter Card)

### Рендеринг Markdown

```tsx
// apps/landing/src/components/BlogContent.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

export function BlogContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children }) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <SyntaxHighlighter language={match[1]} PreTag="div">{String(children)}</SyntaxHighlighter>
          ) : (
            <code className={className}>{children}</code>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
```

### SEO metadata

```tsx
// apps/landing/src/app/blog/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug)
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
      type: 'article',
      publishedTime: post.publishedAt,
    },
  }
}
```

---

## Frontend — Workspace

- WYSIWYG-like: textarea з Markdown + preview панель поруч (split view)
- Кнопки форматування (Bold, Italic, Code, Link) вставляють Markdown синтаксис
- Кнопка "Згенерувати AI" → модальне вікно з темою → показує результат → вставляє в textarea
- Список постів з фільтром по статусу
- Кнопка "Опублікувати" / "Зняти з публікації"

---

## Зв'язки з іншими модулями

| Модуль | Зв'язок |
|---|---|
| **Files** | Обкладинка поста — завантажується через Files module |
| **Auth** | `authorId` — хто опублікував |
| **Search** | Пошук по блогу (tsvector на title + content) |
