import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// Public content endpoints (S7) — no auth. Contact: honeypot + validation + CRM lead
// intake (26-UTM). Blog: read-only.
const contactCreate = vi.fn()
const blogFindMany = vi.fn()
const blogFindFirst = vi.fn()
const agencyFindUnique = vi.fn()
const leadCreate = vi.fn()
const leadActivityCreate = vi.fn()

const db = {
  contactForm: { create: contactCreate },
  blogPost: { findMany: blogFindMany, findFirst: blogFindFirst },
  agency: { findUnique: agencyFindUnique },
  lead: { create: leadCreate },
  leadActivity: { create: leadActivityCreate },
  // ХВІСТ-4: інтейк сідить дефолтні стадії + ставить першу open
  leadStage: {
    count: vi.fn().mockResolvedValue(6),
    createMany: vi.fn(),
    findFirst: vi.fn().mockResolvedValue({ id: 'stage-open-1' }),
  },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  tenantTransaction: (_c: unknown, fn: (tx: unknown) => unknown) => fn(db),
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  runWithAgency: (_id: string, fn: () => unknown) => fn(),
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
  it('persists a valid submission + auto-creates a CRM lead linked back (26-UTM)', async () => {
    agencyFindUnique.mockResolvedValue({ id: 'agency-1' })
    leadCreate.mockResolvedValue({ id: 'lead-9' })
    leadActivityCreate.mockResolvedValue({ id: 'act-1' })
    contactCreate.mockResolvedValue({ id: 'c-1' })
    const res = await post({
      name: 'Іван',
      email: 'ivan@example.com',
      message: 'Привіт',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'summer',
      page: '/contact',
    })
    expect(res.statusCode).toBe(200)
    // lead carries the visitor identity + attribution
    const leadArg = leadCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(leadArg.data.contactName).toBe('Іван')
    expect(leadArg.data.email).toBe('ivan@example.com')
    expect(leadArg.data.utmSource).toBe('google')
    expect(leadArg.data.utmCampaign).toBe('summer')
    // created-activity is journaled as a website intake (no actor)
    const actArg = leadActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(actArg.data.type).toBe('created')
    expect(actArg.data.actorId).toBeNull()
    // contact_forms row keeps the UTM copy + the lead link
    const cfArg = contactCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(cfArg.data.utmSource).toBe('google')
    expect(cfArg.data.leadId).toBe('lead-9')
  })

  it('a non-email contact string goes to notes, not the email column', async () => {
    agencyFindUnique.mockResolvedValue({ id: 'agency-1' })
    leadCreate.mockResolvedValue({ id: 'lead-9' })
    contactCreate.mockResolvedValue({ id: 'c-1' })
    const res = await post({ name: 'Іван', email: '@ivan_tg', message: 'Привіт' })
    expect(res.statusCode).toBe(200)
    const leadArg = leadCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(leadArg.data.email).toBeNull()
    expect(leadArg.data.notes).toContain('@ivan_tg')
  })

  it('lead intake failure still persists the message and returns 200', async () => {
    agencyFindUnique.mockRejectedValue(new Error('db down'))
    contactCreate.mockResolvedValue({ id: 'c-1' })
    const res = await post({ name: 'Іван', email: 'ivan@example.com', message: 'Привіт' })
    expect(res.statusCode).toBe(200)
    expect(contactCreate).toHaveBeenCalledOnce()
    const cfArg = contactCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(cfArg.data.leadId).toBeNull()
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
    expect(leadCreate).not.toHaveBeenCalled()
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
