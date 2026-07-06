import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 18-хвости: mute/archive (Б) + відповідальний за тред (В) + «без відповіді > N год» (Г).
const db = {
  order: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  conversationState: { findUnique: vi.fn(), upsert: vi.fn() },
  agencyMember: { findFirst: vi.fn(), findMany: vi.fn() },
  agency: { findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
  // 18-А: conversations-list — unread raw-запит + імена відповідальних
  profile: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    // 18-А: роут будує unread-запит через Prisma.sql — у тесті вистачає болванки
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const ORDER = 'order-1'
const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const CLIENT = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}

const orderRow = {
  id: ORDER,
  agencyId: AGENCY,
  companyId: 'company-1',
  deletedAt: null,
  chatOwnerId: null,
  assigneeId: 'exec-1',
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET/PUT /orders/:id/conversation (18-Б)', () => {
  it('participant reads default state + effective chat owner (авто = assignee)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow)
    db.conversationState.findUnique.mockResolvedValue(null)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: `/orders/${ORDER}/conversation`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({
      muted: false,
      chatOwnerId: null,
      effectiveChatOwnerId: 'exec-1',
    })
    await app.close()
  })

  it('PUT upserts mute per-user (scoped to profile+order)', async () => {
    db.order.findUnique.mockResolvedValue(orderRow)
    db.conversationState.upsert.mockResolvedValue({ muted: true, archivedAt: null })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PUT',
      url: `/orders/${ORDER}/conversation`,
      headers: { authorization: `Bearer ${token}` },
      payload: { muted: true },
    })
    expect(res.statusCode).toBe(200)
    const arg = db.conversationState.upsert.mock.calls[0]![0] as {
      where: { profileId_orderId: { profileId: string; orderId: string } }
      create: Record<string, unknown>
    }
    expect(arg.where.profileId_orderId).toEqual({ profileId: OWNER.sub, orderId: ORDER })
    expect(arg.create.agencyId).toBe(AGENCY)
    await app.close()
  })

  it('empty body → 400; foreign order → 404', async () => {
    const { app, token } = await authed(OWNER)
    db.order.findUnique.mockResolvedValue(orderRow)
    const empty = await app.inject({
      method: 'PUT',
      url: `/orders/${ORDER}/conversation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(empty.statusCode).toBe(400)

    db.order.findUnique.mockResolvedValue(null)
    const missing = await app.inject({
      method: 'GET',
      url: `/orders/order-x/conversation`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(missing.statusCode).toBe(404)
    await app.close()
  })
})

describe('PATCH /workspace/orders/:id/chat-owner (18-В)', () => {
  it('team sets a responsible member; non-member target → 400; client → 403', async () => {
    db.order.findUnique.mockResolvedValue(orderRow)
    db.agencyMember.findFirst.mockResolvedValue({ id: 'am-1' })
    db.order.update.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const ok = await app.inject({
      method: 'PATCH',
      url: `/workspace/orders/${ORDER}/chat-owner`,
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: 'exec-1' },
    })
    expect(ok.statusCode).toBe(200)
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: ORDER },
      data: { chatOwnerId: 'exec-1' },
    })

    db.agencyMember.findFirst.mockResolvedValue(null)
    const bad = await app.inject({
      method: 'PATCH',
      url: `/workspace/orders/${ORDER}/chat-owner`,
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: 'stranger' },
    })
    expect(bad.statusCode).toBe(400)

    const ctoken = app.jwt.sign(CLIENT as object)
    const denied = await app.inject({
      method: 'PATCH',
      url: `/workspace/orders/${ORDER}/chat-owner`,
      headers: { authorization: `Bearer ${ctoken}` },
      payload: { profileId: null },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })
})

describe('GET /workspace/chats/unanswered (18-Г)', () => {
  it('returns orders where the LAST public message is client-authored and older than N hours', async () => {
    db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }, { profileId: 'exec-1' }])
    const old = new Date(Date.now() - 6 * 3600_000)
    const fresh = new Date(Date.now() - 1 * 3600_000)
    db.order.findMany.mockResolvedValue([
      {
        id: 'o-1',
        title: 'Клієнт чекає',
        chatOwnerId: null,
        assigneeId: 'exec-1',
        company: { name: 'ТОВ' },
        comments: [{ authorId: 'client-1', createdAt: old }],
      },
      {
        id: 'o-2',
        title: 'Команда відповіла',
        chatOwnerId: null,
        assigneeId: null,
        company: { name: 'ТОВ' },
        comments: [{ authorId: 'exec-1', createdAt: old }],
      },
      {
        id: 'o-3',
        title: 'Ще в межах порогу',
        chatOwnerId: null,
        assigneeId: null,
        company: { name: 'ТОВ' },
        comments: [{ authorId: 'client-1', createdAt: fresh }],
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/chats/unanswered?hours=4',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json().data.unanswered as { orderId: string; hoursSince: number }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.orderId).toBe('o-1')
    expect(rows[0]!.hoursSince).toBeGreaterThanOrEqual(5)
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/chats/unanswered',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('GET /workspace/conversations (18-А, хаб «Чати»)', () => {
  const t1 = new Date('2026-07-05T10:00:00Z')
  const t2 = new Date('2026-07-05T12:00:00Z')

  function wireConversations() {
    db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }, { profileId: 'exec-1' }])
    db.order.findMany.mockResolvedValue([
      {
        id: 'o-1',
        title: 'Лендінг',
        internalStatus: 'in_progress',
        chatOwnerId: null,
        assigneeId: 'exec-1',
        companyId: 'company-1',
        company: { name: 'ТОВ Тест' },
        comments: [
          {
            content: 'Клієнт написав довге повідомлення ' + 'x'.repeat(200),
            isInternal: false,
            createdAt: t1,
            authorId: 'client-1',
            author: { name: 'Олена Клієнт' },
          },
        ],
        conversationStates: [],
      },
      {
        id: 'o-2',
        title: 'Бот',
        internalStatus: 'done',
        chatOwnerId: 'owner-1',
        assigneeId: null,
        companyId: 'company-1',
        company: { name: 'ТОВ Тест' },
        comments: [
          {
            content: 'Готово!',
            isInternal: false,
            createdAt: t2,
            authorId: 'owner-1',
            author: { name: 'Власник' },
          },
        ],
        conversationStates: [{ muted: true, archivedAt: new Date() }],
      },
    ])
    db.$queryRaw.mockResolvedValue([{ orderId: 'o-1', unread: 3n }])
    db.profile.findMany.mockResolvedValue([
      { id: 'exec-1', name: 'Петро' },
      { id: 'owner-1', name: 'Власник' },
    ])
  }

  it('returns threads with preview, unread, effective owner, per-user state; newest first', async () => {
    wireConversations()
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/conversations',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json().data.conversations as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    // сортування: свіжіше повідомлення (o-2, t2) перше
    expect(rows.map((r) => r.orderId)).toEqual(['o-2', 'o-1'])

    const o1 = rows[1]! as {
      lastMessage: { preview: string; authorIsTeam: boolean; authorName: string }
      unread: number
      chatOwnerId: string
      chatOwnerName: string
      mine: boolean
      muted: boolean
      archived: boolean
    }
    // прев'ю ріжеться до 140 символів, автор-клієнт → authorIsTeam=false
    expect(o1.lastMessage.preview.length).toBe(140)
    expect(o1.lastMessage.authorIsTeam).toBe(false)
    expect(o1.unread).toBe(3)
    // ефективний відповідальний = assignee (chatOwnerId null)
    expect(o1.chatOwnerId).toBe('exec-1')
    expect(o1.chatOwnerName).toBe('Петро')
    expect(o1.mine).toBe(false)
    expect(o1.muted).toBe(false)
    expect(o1.archived).toBe(false)

    const o2 = rows[0]! as { mine: boolean; muted: boolean; archived: boolean; unread: number }
    // o-2: явний chatOwner = я → mine; мій стан muted+archived; unread нема в raw → 0
    expect(o2.mine).toBe(true)
    expect(o2.muted).toBe(true)
    expect(o2.archived).toBe(true)
    expect(o2.unread).toBe(0)
    await app.close()
  })

  it('skips the unread raw query when there are no threads', async () => {
    db.agencyMember.findMany.mockResolvedValue([{ profileId: 'owner-1' }])
    db.order.findMany.mockResolvedValue([])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/conversations',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.conversations).toEqual([])
    expect(db.$queryRaw).not.toHaveBeenCalled()
    await app.close()
  })

  it('client is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/conversations',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('GET /portal/conversations (18-А, portal-inbox)', () => {
  it('client sees own-company threads with PUBLIC-only preview and unread', async () => {
    db.order.findMany.mockResolvedValue([
      {
        id: 'o-1',
        title: 'Лендінг',
        clientStatus: 'in_progress',
        companyId: 'company-1',
        company: { name: 'ТОВ Тест' },
        comments: [
          {
            content: 'Публічна відповідь команди',
            createdAt: new Date('2026-07-05T10:00:00Z'),
            authorId: 'owner-1',
            author: { name: 'Власник' },
          },
        ],
        conversationStates: [],
      },
    ])
    db.$queryRaw.mockResolvedValue([{ orderId: 'o-1', unread: 2n }])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/conversations',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json().data.conversations as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      orderId: 'o-1',
      unread: 2,
      lastMessage: { authorName: 'Власник', isMine: false },
    })

    // КЛІЄНТСЬКИЙ скоуп: лише мої компанії + лише публічні коментарі (прев'ю)
    const where = db.order.findMany.mock.calls[0]![0].where
    expect(where.companyId).toEqual({ in: ['company-1'] })
    expect(where.comments.some.isInternal).toBe(false)
    const select = db.order.findMany.mock.calls[0]![0].select
    expect(select.comments.where.isInternal).toBe(false)
    // ... і в unread-запиті — фільтр isInternal = false
    const sqlArg = db.$queryRaw.mock.calls[0]![0] as { strings: readonly string[] }
    expect(sqlArg.strings.join('?')).toContain('"isInternal" = false')
    await app.close()
  })

  it('company-less account gets an empty list (no query)', async () => {
    const noCompany = { ...CLIENT, memberships: [] }
    const { app, token } = await authed(noCompany)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/conversations',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.conversations).toEqual([])
    expect(db.order.findMany).not.toHaveBeenCalled()
    await app.close()
  })
})
