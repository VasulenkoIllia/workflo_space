import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const notificationFindMany = vi.fn()
const notificationCount = vi.fn()
const notificationUpdateMany = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    notification: {
      findMany: notificationFindMany,
      count: notificationCount,
      updateMany: notificationUpdateMany,
    },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  tenantTransaction: vi.fn(),
  withTenant: vi.fn(),
}))

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

// profileId guard = request.user.sub. This is "user A".
const CLAIMS = {
  sub: 'profile-A',
  email: 'a@e.com',
  role: 'client' as const,
  activeCompanyId: 'company-1',
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const row = (id: string, isRead = false) => ({
  id,
  type: 'order.created',
  title: 't',
  body: 'b',
  isRead,
  metadata: {},
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
})

async function withApp<T>(
  fn: (app: Awaited<ReturnType<typeof buildApp>>) => Promise<T>
): Promise<T> {
  const app = buildApp()
  await app.ready()
  try {
    return await fn(app)
  } finally {
    await app.close()
  }
}

describe('GET /notifications (personal feed, profileId-scoped)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('scopes the read to the caller and returns feed + unread count', async () => {
    notificationFindMany.mockResolvedValue([row('n1'), row('n2', true)])
    notificationCount.mockResolvedValue(1)

    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.notifications).toHaveLength(2)
      expect(body.data.meta).toEqual({ hasMore: false, unreadCount: 1 })

      // IDOR guard: both queries filter by the caller's own profileId.
      expect(notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: 'profile-A' },
          orderBy: { createdAt: 'desc' },
          take: 21, // default limit 20 + 1 to detect hasMore
        })
      )
      expect(notificationCount).toHaveBeenCalledWith({
        where: { profileId: 'profile-A', isRead: false },
      })
    })
  })

  it('detects hasMore by over-fetching limit+1 and trims to limit', async () => {
    // limit=2 → take 3; return 3 rows → hasMore true, only 2 returned.
    notificationFindMany.mockResolvedValue([row('n1'), row('n2'), row('n3')])
    notificationCount.mockResolvedValue(3)

    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const res = await app.inject({
        method: 'GET',
        url: '/notifications?limit=2',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.notifications).toHaveLength(2)
      expect(body.data.meta.hasMore).toBe(true)
      expect(notificationFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }))
    })
  })

  it('applies the `before` cursor as createdAt < before', async () => {
    notificationFindMany.mockResolvedValue([])
    notificationCount.mockResolvedValue(0)

    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const before = '2026-05-01T00:00:00.000Z'
      const res = await app.inject({
        method: 'GET',
        url: `/notifications?before=${before}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: 'profile-A', createdAt: { lt: new Date(before) } },
        })
      )
    })
  })

  it('rejects an out-of-range limit with 400', async () => {
    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const res = await app.inject({
        method: 'GET',
        url: '/notifications?limit=999',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(400)
      expect(notificationFindMany).not.toHaveBeenCalled()
    })
  })

  it('returns 401 without a token (no DB touched)', async () => {
    await withApp(async (app) => {
      const res = await app.inject({ method: 'GET', url: '/notifications' })
      expect(res.statusCode).toBe(401)
      expect(notificationFindMany).not.toHaveBeenCalled()
    })
  })
})

describe('PATCH /notifications/:id/read (own row only)', () => {
  beforeEach(() => vi.clearAllMocks())

  it("flips read scoped to {id, profileId} — never another user's row", async () => {
    notificationUpdateMany.mockResolvedValue({ count: 1 })
    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const res = await app.inject({
        method: 'PATCH',
        url: '/notifications/n1/read',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ id: 'n1' })
      expect(notificationUpdateMany).toHaveBeenCalledWith({
        where: { id: 'n1', profileId: 'profile-A' },
        data: { isRead: true },
      })
    })
  })

  it('is a safe no-op (still 200) when the id belongs to someone else', async () => {
    // updateMany matches 0 rows because profileId differs — no info leak, idempotent.
    notificationUpdateMany.mockResolvedValue({ count: 0 })
    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const res = await app.inject({
        method: 'PATCH',
        url: '/notifications/someone-elses-id/read',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(notificationUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'someone-elses-id', profileId: 'profile-A' } })
      )
    })
  })

  it('returns 401 without a token', async () => {
    await withApp(async (app) => {
      const res = await app.inject({ method: 'PATCH', url: '/notifications/n1/read' })
      expect(res.statusCode).toBe(401)
      expect(notificationUpdateMany).not.toHaveBeenCalled()
    })
  })
})

describe('POST /notifications/read-all (own unread only)', () => {
  beforeEach(() => vi.clearAllMocks())

  it("flips only the caller's unread rows and reports the count", async () => {
    notificationUpdateMany.mockResolvedValue({ count: 5 })
    await withApp(async (app) => {
      const token = app.jwt.sign(CLAIMS)
      const res = await app.inject({
        method: 'POST',
        url: '/notifications/read-all',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ updated: 5 })
      expect(notificationUpdateMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-A', isRead: false },
        data: { isRead: true },
      })
    })
  })

  it('returns 401 without a token', async () => {
    await withApp(async (app) => {
      const res = await app.inject({ method: 'POST', url: '/notifications/read-all' })
      expect(res.statusCode).toBe(401)
      expect(notificationUpdateMany).not.toHaveBeenCalled()
    })
  })
})
