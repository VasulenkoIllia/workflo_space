import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const orderFindUnique = vi.fn()
const commentFindFirst = vi.fn()
const commentUpdate = vi.fn()
const commentFindUniqueOrThrow = vi.fn()
const reactionUpsert = vi.fn()
const reactionDeleteMany = vi.fn()
const profileFindUnique = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  const db = {
    order: { findUnique: orderFindUnique },
    orderComment: {
      findFirst: commentFindFirst,
      update: commentUpdate,
      findUniqueOrThrow: commentFindUniqueOrThrow,
    },
    commentReaction: { upsert: reactionUpsert, deleteMany: reactionDeleteMany },
    profile: { findUnique: profileFindUnique },
  }
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
    runWithAgency: (_a: string, fn: () => unknown) => fn(),
    enterAgencyContext: vi.fn(),
  }
})

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}
const OWNER = {
  ...EXECUTOR,
  sub: 'owner-1',
  role: 'owner' as const,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
}

const FULL_ROW = {
  id: 'c1',
  content: 'нове',
  isInternal: false,
  createdAt: new Date(),
  editedAt: new Date(),
  author: { id: 'exec-1', name: 'E', agencyMemberships: [{ agencyId: AGENCY }] },
  replyTo: null,
  attachments: [],
  mentionIds: [],
  reactions: [],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  orderFindUnique.mockResolvedValue({
    id: 'order-1',
    agencyId: AGENCY,
    companyId: 'company-1',
    deletedAt: null,
  })
  commentUpdate.mockResolvedValue({})
  commentFindUniqueOrThrow.mockResolvedValue(FULL_ROW)
  reactionUpsert.mockResolvedValue({})
  profileFindUnique.mockResolvedValue({ name: 'E' })
})
afterEach(() => vi.clearAllMocks())

describe('PATCH /orders/:id/comments/:commentId', () => {
  it('author edits within 15 minutes → 200, editedAt set', async () => {
    commentFindFirst.mockResolvedValue({
      id: 'c1',
      authorId: 'exec-1',
      createdAt: new Date(Date.now() - 60_000),
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'нове' },
    })
    expect(res.statusCode).toBe(200)
    expect(commentUpdate.mock.calls[0][0].data.editedAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('author outside the 15-minute window → 400', async () => {
    commentFindFirst.mockResolvedValue({
      id: 'c1',
      authorId: 'exec-1',
      createdAt: new Date(Date.now() - 20 * 60_000),
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'нове' },
    })
    expect(res.statusCode).toBe(400)
    expect(commentUpdate).not.toHaveBeenCalled()
    await app.close()
  })

  it("owner edits someone else's old message → 200 (canon: owner anytime)", async () => {
    commentFindFirst.mockResolvedValue({
      id: 'c1',
      authorId: 'exec-1',
      createdAt: new Date(Date.now() - 60 * 60_000),
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'нове' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it("executor editing someone else's message → 403", async () => {
    commentFindFirst.mockResolvedValue({
      id: 'c1',
      authorId: 'other',
      createdAt: new Date(),
    })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'нове' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('DELETE /orders/:id/comments/:commentId', () => {
  it('author soft-deletes own message', async () => {
    commentFindFirst.mockResolvedValue({ id: 'c1', authorId: 'exec-1' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(commentUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    await app.close()
  })

  it("executor deleting someone else's → 403; owner → 200", async () => {
    commentFindFirst.mockResolvedValue({ id: 'c1', authorId: 'other' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()

    const { app: app2, token: token2 } = await authed(OWNER)
    const res2 = await app2.inject({
      method: 'DELETE',
      url: '/orders/order-1/comments/c1',
      headers: { authorization: `Bearer ${token2}` },
    })
    expect(res2.statusCode).toBe(200)
    await app2.close()
  })
})

describe('reactions', () => {
  it('POST adds a reaction (upsert = idempotent)', async () => {
    commentFindFirst.mockResolvedValue({ id: 'c1' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/comments/c1/reactions',
      headers: { authorization: `Bearer ${token}` },
      payload: { emoji: '👍' },
    })
    expect(res.statusCode).toBe(200)
    expect(reactionUpsert.mock.calls[0][0].create).toMatchObject({
      commentId: 'c1',
      profileId: 'exec-1',
      emoji: '👍',
    })
    await app.close()
  })

  it('rejects an emoji outside the allowed set (400)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/comments/c1/reactions',
      headers: { authorization: `Bearer ${token}` },
      payload: { emoji: '💩' },
    })
    expect(res.statusCode).toBe(400)
    expect(reactionUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('DELETE removes own reaction only (scoped deleteMany)', async () => {
    reactionDeleteMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: '/orders/order-1/comments/c1/reactions',
      headers: { authorization: `Bearer ${token}` },
      payload: { emoji: '👍' },
    })
    expect(res.statusCode).toBe(200)
    expect(reactionDeleteMany.mock.calls[0][0].where).toMatchObject({
      commentId: 'c1',
      profileId: 'exec-1',
      emoji: '👍',
    })
    await app.close()
  })
})

describe('typing', () => {
  it('POST typing → 200 (ephemeral, no comment writes)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/comments/typing',
      headers: { authorization: `Bearer ${token}` },
      payload: { internal: false },
    })
    expect(res.statusCode).toBe(200)
    expect(commentUpdate).not.toHaveBeenCalled()
    await app.close()
  })
})
