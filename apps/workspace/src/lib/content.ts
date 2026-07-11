import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** S7-05 міні-CMS: блог + кейси лендінга з workspace /content (owner-only). */
export type BlogBlockType = 'h2' | 'p' | 'ul' | 'code' | 'callout' | 'quote'
export interface BlogBlock {
  t: BlogBlockType
  v: string | string[]
  k?: string
  author?: string
  lang?: string
}

export interface CmsPostRow {
  id: string
  slug: string
  type: 'article' | 'case_study'
  titleUk: string
  tags: string[]
  published: boolean
  featured: boolean
  publishedAt: string | null
  updatedAt: string
}

export interface CmsPost extends CmsPostRow {
  titleEn: string
  excerptUk: string
  excerptEn: string
  contentUk: BlogBlock[]
  contentEn: BlogBlock[]
}

export interface CmsPostInput {
  slug: string
  type: 'article' | 'case_study'
  titleUk: string
  titleEn: string
  excerptUk: string
  excerptEn: string
  contentUk: BlogBlock[]
  contentEn: BlogBlock[]
  tags: string[]
  featured: boolean
}

export interface BlogDraft extends Omit<CmsPostInput, 'featured'> {
  tags: string[]
}

// ── Блоки ↔ міні-markdown (редактор пише текстом, лендінг рендерить блоки) ──────
// `## ` → h2 · `- ` (усі рядки) → ul · `> ` → quote · `! ` → callout · ``` → code · решта → p
export function blocksToText(blocks: BlogBlock[]): string {
  return blocks
    .map((b) => {
      const v = Array.isArray(b.v) ? b.v : [b.v]
      switch (b.t) {
        case 'h2':
          return `## ${v.join(' ')}`
        case 'ul':
          return v.map((i) => `- ${i}`).join('\n')
        case 'quote':
          return v.map((i) => `> ${i}`).join('\n')
        case 'callout':
          return v.map((i) => `! ${i}`).join('\n')
        case 'code':
          return '```\n' + v.join('\n') + '\n```'
        default:
          return v.join(' ')
      }
    })
    .join('\n\n')
}

export function textToBlocks(text: string): BlogBlock[] {
  const blocks: BlogBlock[] = []
  // code-фенси виділяємо до розбиття на порожні рядки
  const parts = text.split(/```/)
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? ''
    if (i % 2 === 1) {
      const code = part.replace(/^\n/, '').replace(/\n$/, '')
      if (code.trim()) blocks.push({ t: 'code', v: code })
      continue
    }
    for (const chunk of part.split(/\n\s*\n/)) {
      const lines = chunk.split('\n').filter((l) => l.trim() !== '')
      if (lines.length === 0) continue
      const first = lines[0] ?? ''
      if (first.startsWith('## ')) {
        blocks.push({ t: 'h2', v: first.slice(3).trim() })
        const rest = lines.slice(1).join(' ').trim()
        if (rest) blocks.push({ t: 'p', v: rest })
      } else if (lines.every((l) => l.startsWith('- '))) {
        blocks.push({ t: 'ul', v: lines.map((l) => l.slice(2).trim()) })
      } else if (lines.every((l) => l.startsWith('> '))) {
        blocks.push({ t: 'quote', v: lines.map((l) => l.slice(2).trim()).join(' ') })
      } else if (lines.every((l) => l.startsWith('! '))) {
        blocks.push({ t: 'callout', v: lines.map((l) => l.slice(2).trim()).join(' ') })
      } else {
        blocks.push({ t: 'p', v: lines.join(' ').trim() })
      }
    }
  }
  return blocks
}

// ── Hooks ───────────────────────────────────────────────────────────────────────
export function useCmsPosts() {
  return useQuery({
    queryKey: ['cms-posts'],
    queryFn: () =>
      api.get<{ posts: CmsPostRow[] }>('/workspace/content/posts').then((r) => r.posts),
  })
}

export function useCmsPost(id: string | null) {
  return useQuery({
    queryKey: ['cms-post', id],
    queryFn: () => api.get<{ post: CmsPost }>(`/workspace/content/posts/${id}`).then((r) => r.post),
    enabled: id != null,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['cms-posts'] })
  void qc.invalidateQueries({ queryKey: ['cms-post'] })
}

export function useCreateCmsPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CmsPostInput) =>
      api.post<{ post: CmsPost }>('/workspace/content/posts', body).then((r) => r.post),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateCmsPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CmsPostInput> & { id: string }) =>
      api.patch<{ post: CmsPost }>(`/workspace/content/posts/${id}`, body).then((r) => r.post),
    onSuccess: () => invalidate(qc),
  })
}

export function usePublishCmsPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.post(`/workspace/content/posts/${id}/publish`, { published }),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteCmsPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/content/posts/${id}`),
    onSuccess: () => invalidate(qc),
  })
}

export function useGenerateDraft() {
  return useMutation({
    mutationFn: (body: { topic: string; type: 'article' | 'case_study' }) =>
      api.post<{ draft: BlogDraft }>('/workspace/content/generate', body).then((r) => r.draft),
  })
}

// ── TESTIMONIALS (Фаза B): відгуки лендінга — owner-CRUD, лендінг читає published ──
export interface Testimonial {
  id: string
  authorName: string
  authorRole: string | null
  company: string | null
  text: string
  rating: number
  featured: boolean
  published: boolean
  position: number
  updatedAt: string
}

export interface TestimonialInput {
  authorName: string
  authorRole?: string | null
  company?: string | null
  text: string
  rating: number
  featured: boolean
}

export function useTestimonials() {
  return useQuery({
    queryKey: ['cms-testimonials'],
    queryFn: () =>
      api
        .get<{ testimonials: Testimonial[] }>('/workspace/content/testimonials')
        .then((r) => r.testimonials),
  })
}

function invalidateTestimonials(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['cms-testimonials'] })
}

export function useCreateTestimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TestimonialInput) => api.post('/workspace/content/testimonials', body),
    onSuccess: () => invalidateTestimonials(qc),
  })
}

export function useUpdateTestimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: Partial<TestimonialInput & { published: boolean; position: number }> & { id: string }) =>
      api.patch(`/workspace/content/testimonials/${id}`, body),
    onSuccess: () => invalidateTestimonials(qc),
  })
}

export function useDeleteTestimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/content/testimonials/${id}`),
    onSuccess: () => invalidateTestimonials(qc),
  })
}
