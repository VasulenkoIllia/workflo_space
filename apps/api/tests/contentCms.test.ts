import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
delete process.env.ANTHROPIC_API_KEY // generate без ключа → 503

// S7-05 МІНІ-CMS: owner-gated CRUD блога/кейсів + publish (stamp once) + AI-503.
const postFindMany = vi.fn()
const postFindUnique = vi.fn()
const postCreate = vi.fn()
const postUpdate = vi.fn()
const postDelete = vi.fn()

const db = {
  blogPost: {
    findMany: postFindMany,
    findUnique: postFindUnique,
    create: postCreate,
    update: postUpdate,
    delete: postDelete,
  },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

const VALID = {
  slug: 'proces-rozrobky',
  type: 'article',
  titleUk: 'Процес розробки',
  titleEn: 'Development process',
  excerptUk: 'Як ми будуємо проєкти.',
  excerptEn: 'How we build projects.',
  contentUk: [
    { t: 'h2', v: 'Початок' },
    { t: 'p', v: 'Текст.' },
  ],
  contentEn: [
    { t: 'h2', v: 'Start' },
    { t: 'p', v: 'Text.' },
  ],
  tags: ['процеси'],
  featured: false,
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('S7-05 CMS /workspace/content', () => {
  it('owner creates a draft (201, published=false, author=sub)', async () => {
    postCreate.mockResolvedValue({ id: 'post-1', ...VALID, published: false })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/content/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: VALID,
    })
    expect(res.statusCode).toBe(201)
    const data = postCreate.mock.calls[0][0].data
    expect(data.published).toBe(false)
    expect(data.authorId).toBe('owner-1')
    await app.close()
  })

  it('executor is forbidden (403) — контент редагує лише власник', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/content/posts',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('невалідний slug (не kebab-case) → 400', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/content/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...VALID, slug: 'Не Латиниця!' },
    })
    expect(res.statusCode).toBe(400)
    expect(postCreate).not.toHaveBeenCalled()
    await app.close()
  })

  it('publish штампує publishedAt ОДИН раз (стабільна дата)', async () => {
    postFindUnique.mockResolvedValue({ id: 'post-1', publishedAt: null })
    postUpdate.mockResolvedValue({ id: 'post-1', published: true })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/content/posts/post-1/publish',
      headers: { authorization: `Bearer ${token}` },
      payload: { published: true },
    })
    expect(res.statusCode).toBe(200)
    expect(postUpdate.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date)

    // повторний publish (уже має publishedAt) → дату НЕ чіпаємо
    vi.clearAllMocks()
    postFindUnique.mockResolvedValue({ id: 'post-1', publishedAt: new Date('2026-07-01') })
    postUpdate.mockResolvedValue({ id: 'post-1', published: true })
    const res2 = await app.inject({
      method: 'POST',
      url: '/workspace/content/posts/post-1/publish',
      headers: { authorization: `Bearer ${token}` },
      payload: { published: true },
    })
    expect(res2.statusCode).toBe(200)
    expect(postUpdate.mock.calls[0][0].data.publishedAt).toBeUndefined()
    await app.close()
  })

  it('generate без ANTHROPIC_API_KEY → 503 з підказкою', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/content/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { topic: 'Як ми ведемо проєкти в workflo', type: 'article' },
    })
    expect(res.statusCode).toBe(503)
    expect(res.json().error.message).toMatch(/ANTHROPIC_API_KEY/)
    await app.close()
  })

  it('list повертає і чернетки (owner-редактор бачить усе)', async () => {
    postFindMany.mockResolvedValue([
      { id: 'p1', slug: 'a', type: 'article', titleUk: 'A', published: false },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/content/posts',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.posts).toHaveLength(1)
    // без where { published: true } — чернетки включно
    expect(postFindMany.mock.calls[0][0].where).toBeUndefined()
    await app.close()
  })
})
