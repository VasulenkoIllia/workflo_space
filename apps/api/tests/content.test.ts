import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// Public content endpoints (S7) — no auth. Contact: honeypot + validation. Blog: read-only.
const contactCreate = vi.fn()
const blogFindMany = vi.fn()
const blogFindFirst = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    contactForm: { create: contactCreate },
    blogPost: { findMany: blogFindMany, findFirst: blogFindFirst },
  },
  tenantTransaction: (c: unknown, fn: (tx: unknown) => unknown) => fn(c),
  withTenant: (fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

let app: Awaited<ReturnType<typeof buildApp>>
beforeAll(async () => {
  app = await buildApp()
})
afterEach(() => vi.clearAllMocks())

const post = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/content/contact', payload: payload as object })

describe('POST /content/contact', () => {
  it('persists a valid submission', async () => {
    contactCreate.mockResolvedValue({ id: 'c-1' })
    const res = await post({ name: 'Іван', email: 'ivan@example.com', message: 'Привіт' })
    expect(res.statusCode).toBe(200)
    expect(contactCreate).toHaveBeenCalledOnce()
  })

  it('honeypot field ⇒ 200 but stores nothing', async () => {
    const res = await post({
      name: 'Bot',
      email: 'bot@example.com',
      message: 'spam',
      website: 'http://spam.example',
    })
    expect(res.statusCode).toBe(200)
    expect(contactCreate).not.toHaveBeenCalled()
  })

  it('rejects invalid input with 400', async () => {
    const res = await post({ name: '', email: 'not-an-email', message: '' })
    expect(res.statusCode).toBe(400)
    expect(contactCreate).not.toHaveBeenCalled()
  })
})

describe('GET /content/blog', () => {
  it('lists published posts + derives tags & reading-time', async () => {
    blogFindMany.mockResolvedValue([
      {
        slug: 'p1',
        type: 'article',
        titleUk: 'Заголовок',
        excerptUk: 'Опис',
        tags: ['ai', 'процеси'],
        featured: true,
        publishedAt: new Date('2026-06-01'),
        contentUk: [{ t: 'p', v: 'слово '.repeat(400) }],
      },
    ])
    const res = await app.inject({ method: 'GET', url: '/content/blog' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { posts: { title: string; reading: string }[]; tags: string[] }
    }
    expect(body.data.posts[0].title).toBe('Заголовок')
    expect(body.data.posts[0].reading).toBe('2 хв') // 400 words / 200
    expect(body.data.tags).toEqual(['усі', 'ai', 'процеси'])
  })
})

describe('GET /content/blog/:slug', () => {
  it('returns a published post with body blocks', async () => {
    blogFindFirst.mockResolvedValue({
      slug: 'p1',
      type: 'article',
      titleUk: 'Заголовок',
      excerptUk: 'Опис',
      tags: ['ai'],
      publishedAt: new Date('2026-06-01'),
      contentUk: [{ t: 'h2', v: 'Розділ' }],
    })
    const res = await app.inject({ method: 'GET', url: '/content/blog/p1' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { body: { t: string }[] } }
    expect(body.data.body[0].t).toBe('h2')
  })

  it('404 for a missing/unpublished slug', async () => {
    blogFindFirst.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/content/blog/nope' })
    expect(res.statusCode).toBe(404)
  })
})
