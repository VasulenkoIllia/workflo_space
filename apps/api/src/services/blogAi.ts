import { ApiErrorCode, AppError } from '@workflo/types'

/**
 * S7-05 AI-генерація чернетки блог-поста/кейса. Прямий fetch до Anthropic Messages API
 * (без SDK — одна залежність менше). Ключ — env ANTHROPIC_API_KEY; без ключа → 503 з
 * чіткою підказкою (фіча опційна, CMS повноцінна і без неї). Модель — env-override
 * BLOG_AI_MODEL (дефолт claude-sonnet-5). Повертає draft рівно у shape редактора:
 * двомовні title/excerpt + блоки {t,v} (h2/p/ul/quote), tags і slug.
 */
export interface BlogDraft {
  slug: string
  titleUk: string
  titleEn: string
  excerptUk: string
  excerptEn: string
  contentUk: Array<{ t: string; v: string | string[] }>
  contentEn: Array<{ t: string; v: string | string[] }>
  tags: string[]
}

const SYSTEM = `Ти — контент-редактор digital-агенції workflo.space (укр. ринок, вебпродакшн/дизайн/маркетинг).
Згенеруй чернетку для блогу. Поверни СУТО валідний JSON (без markdown-обгортки) такої форми:
{"slug":"kebab-case-latin","titleUk":"...","titleEn":"...","excerptUk":"...","excerptEn":"...",
"contentUk":[{"t":"h2","v":"..."},{"t":"p","v":"..."},{"t":"ul","v":["...","..."]},{"t":"quote","v":"..."}],
"contentEn":[...той самий формат англійською...],"tags":["...","..."]}
Правила: 4-6 секцій h2, кожна з 1-3 абзацами p; хоча б один ul; тон — практичний, без води;
excerpt ≤ 2 речення; tags — 3-5 коротких; slug — латиницею з дефісами. Для type=case_study —
структура кейса: задача → підхід → рішення → результат (з цифрами-плейсхолдерами, якщо фактів нема).`

export async function generateBlogDraft(
  topic: string,
  type: 'article' | 'case_study'
): Promise<BlogDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AppError(
      ApiErrorCode.CONFLICT,
      'AI-генерація недоступна: задай ANTHROPIC_API_KEY у env API',
      503
    )
  }
  const model = process.env.BLOG_AI_MODEL ?? 'claude-sonnet-5'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: `type=${type}. Тема: ${topic}` }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new AppError(
      ApiErrorCode.INTERNAL_ERROR,
      `AI-генерація не вдалася (${res.status}): ${detail.slice(0, 200)}`,
      502
    )
  }
  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = payload.content?.find((c) => c.type === 'text')?.text ?? ''
  // Модель інколи обгортає JSON у ```json-фенс — зрізаємо перед парсом.
  const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  let draft: BlogDraft
  try {
    draft = JSON.parse(raw) as BlogDraft
  } catch {
    throw new AppError(
      ApiErrorCode.INTERNAL_ERROR,
      'AI повернув невалідний JSON — спробуй ще раз',
      502
    )
  }
  if (!draft.titleUk || !Array.isArray(draft.contentUk) || draft.contentUk.length === 0) {
    throw new AppError(ApiErrorCode.INTERNAL_ERROR, 'AI-чернетка неповна — спробуй ще раз', 502)
  }
  return draft
}
