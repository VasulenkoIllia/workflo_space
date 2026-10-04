// blog.ts — read-only fetchers for the public blog API (S7-02). `cache: 'no-store'` keeps the
// pages dynamic (no build-time API dependency in CI; fresh per request). Fail-soft to empty.

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://dev-api.workflo.space'

export interface BlogListItem {
  slug: string
  type: 'article' | 'case_study'
  title: string
  excerpt: string
  tags: string[]
  featured: boolean
  date: string | null
  reading: string
}

export interface BlogBlock {
  t: 'h2' | 'p' | 'ul' | 'code' | 'callout' | 'quote'
  v: string | string[]
  k?: string
  author?: string
  lang?: string
}

export interface BlogDetail {
  slug: string
  type: 'article' | 'case_study'
  title: string
  excerpt: string
  tags: string[]
  date: string | null
  reading: string
  body: BlogBlock[]
}

export async function fetchBlogList(): Promise<{ posts: BlogListItem[]; tags: string[] }> {
  try {
    const res = await fetch(`${API}/content/blog`, { cache: 'no-store' })
    if (!res.ok) return { posts: [], tags: ['усі'] }
    const json = (await res.json()) as { data?: { posts: BlogListItem[]; tags: string[] } }
    return json.data ?? { posts: [], tags: ['усі'] }
  } catch {
    return { posts: [], tags: ['усі'] }
  }
}

export async function fetchBlogPost(slug: string): Promise<BlogDetail | null> {
  try {
    const res = await fetch(`${API}/content/blog/${slug}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: BlogDetail }
    return json.data ?? null
  } catch {
    return null
  }
}

/** UA short date: "12 бер 2026". */
export function fmtBlogDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const m = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру']
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`
}
