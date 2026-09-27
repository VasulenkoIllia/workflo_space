import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PORTAL-MEMBER: власник компанії керує правами учасників і видаляє їх; власника не чіпаємо.
const memberFindUnique = vi.fn()
const memberUpdate = vi.fn()
const memberDelete = vi.fn()
const db = {
  companyMember: {
    findUnique: memberFindUnique,
    update: memberUpdate,
    delete: memberDelete,
    findMany: vi.fn(),
  },
  order: { groupBy: vi.fn() },
  orderComment: { groupBy: vi.fn() },
  refreshToken: { groupBy: vi.fn() },
  company: { findFirst: vi.fn() },
  document: { findFirst: vi.fn() },
}
vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  return {
    prisma: db,
    Prisma: actual.Prisma,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { clientSeesMoney, clientSeesBillingDocs } = await import('../src/auth/companyAccess.js')

const base = {
  email: 'c@e.com',
  role: 'client',
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [],
}
const COMPANY_OWNER = {
  ...base,
  sub: 'owner-1',
  memberships: [{ companyId: 'company-1', role: 'owner' }],
}
const COMPANY_MEMBER = {
  ...base,
  sub: 'm-1',
  memberships: [{ companyId: 'company-1', role: 'member' }],
}

async function call(claims: object, method: 'PATCH' | 'DELETE', url: string, payload?: object) {
  const app = buildApp()
  await app.ready()
  const res = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${app.jwt.sign(claims as never)}` },
    ...(payload ? { payload } : {}),
  })
  await app.close()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('PORTAL-MEMBER: права учасників компанії', () => {
  it('власник компанії вмикає учаснику білінг (мерж із наявними прапорцями)', async () => {
    memberFindUnique.mockResolvedValue({
      role: 'member',
      permissions: { can_invite_members: true },
    })
    memberUpdate.mockResolvedValue({})
    const res = await call(COMPANY_OWNER, 'PATCH', '/portal/company/members/m-2/permissions', {
      can_view_billing: true,
    })
    expect(res.statusCode).toBe(200)
    expect(memberUpdate.mock.calls[0][0].data.permissions).toEqual({
      can_invite_members: true,
      can_view_billing: true,
    })
  })

  it('учасник (не власник) змінювати права не може → 403', async () => {
    const res = await call(COMPANY_MEMBER, 'PATCH', '/portal/company/members/m-2/permissions', {
      can_view_billing: true,
    })
    expect(res.statusCode).toBe(403)
    expect(memberUpdate).not.toHaveBeenCalled()
  })

  it('права власника компанії не змінюються → 400; невідомий прапорець → 400', async () => {
    memberFindUnique.mockResolvedValue({ role: 'owner', permissions: null })
    const owner = await call(
      COMPANY_OWNER,
      'PATCH',
      '/portal/company/members/owner-2/permissions',
      {
        can_view_billing: false,
      }
    )
    expect(owner.statusCode).toBe(400)
    const unknown = await call(COMPANY_OWNER, 'PATCH', '/portal/company/members/m-2/permissions', {
      can_do_anything: true,
    })
    expect(unknown.statusCode).toBe(400)
    expect(memberUpdate).not.toHaveBeenCalled()
  })

  it('видалення учасника: власник — так; себе/власника — ні; учасник — 403', async () => {
    memberFindUnique.mockResolvedValue({ role: 'member' })
    memberDelete.mockResolvedValue({})
    expect((await call(COMPANY_OWNER, 'DELETE', '/portal/company/members/m-2')).statusCode).toBe(
      200
    )
    expect(
      (await call(COMPANY_OWNER, 'DELETE', '/portal/company/members/owner-1')).statusCode
    ).toBe(400)
    memberFindUnique.mockResolvedValue({ role: 'owner' })
    expect(
      (await call(COMPANY_OWNER, 'DELETE', '/portal/company/members/owner-2')).statusCode
    ).toBe(400)
    expect((await call(COMPANY_MEMBER, 'DELETE', '/portal/company/members/m-2')).statusCode).toBe(
      403
    )
    expect(memberDelete).toHaveBeenCalledTimes(1)
  })
})

describe('PORTAL-MEMBER: суми й грошові документи учасника', () => {
  const member = (permissions?: object) => ({
    memberships: [{ companyId: 'company-1', role: 'member' as const, permissions }],
  })

  it('власник бачить суми й грошові документи; чужа компанія — ні', () => {
    const owner = { memberships: [{ companyId: 'company-1', role: 'owner' as const }] }
    expect(clientSeesMoney(owner, 'company-1')).toBe(true)
    expect(clientSeesBillingDocs(owner, 'company-1')).toBe(true)
    expect(clientSeesMoney(owner, 'company-2')).toBe(false)
  })

  it('учасник без прапорців — без сум; погоджувач бачить суми, але не рахунки', () => {
    expect(clientSeesMoney(member(), 'company-1')).toBe(false)
    expect(clientSeesMoney(member({ can_approve_estimates: true }), 'company-1')).toBe(true)
    expect(clientSeesBillingDocs(member({ can_approve_estimates: true }), 'company-1')).toBe(false)
    expect(clientSeesBillingDocs(member({ can_view_billing: true }), 'company-1')).toBe(true)
  })

  it('місячний звіт (PDF) учаснику без can_view_billing → 403', async () => {
    db.document.findFirst.mockResolvedValue({
      id: 'd-1',
      number: 'RPT-1',
      generatedAt: new Date(),
      agencyId: 'agency-2',
      companyId: 'company-1',
      agency: { name: 'A' },
      company: { name: 'C' },
    })
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/documents/d-1/pdf',
      headers: { authorization: `Bearer ${app.jwt.sign(COMPANY_MEMBER as never)}` },
    })
    await app.close()
    expect(res.statusCode).toBe(403)
  })
})

describe('DSN-6: активність учасників у GET /portal/company/members', () => {
  it('рахує відкриті замовлення, коментарі за 30 днів і останню активність — у межах компанії', async () => {
    db.companyMember.findMany.mockResolvedValue([
      {
        role: 'owner',
        joinedAt: new Date('2026-06-01'),
        permissions: {},
        profile: { id: 'owner-1', name: 'Власник', email: 'o@e.com' },
      },
      {
        role: 'member',
        joinedAt: new Date('2026-07-01'),
        permissions: { can_view_billing: true },
        profile: { id: 'm-1', name: 'Учасник', email: 'm@e.com' },
      },
    ])
    db.order.groupBy.mockResolvedValue([{ createdById: 'm-1', _count: { _all: 2 } }])
    db.orderComment.groupBy.mockResolvedValue([{ authorId: 'owner-1', _count: { _all: 5 } }])
    const seen = new Date('2026-09-26T10:00:00Z')
    db.refreshToken.groupBy.mockResolvedValue([{ profileId: 'm-1', _max: { createdAt: seen } }])
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/portal/company/members',
      headers: { authorization: `Bearer ${app.jwt.sign(COMPANY_OWNER as never)}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const [owner, member] = res.json().data.members
    expect(owner).toMatchObject({ activeOrders: 0, comments30d: 5, lastActiveAt: null })
    expect(member).toMatchObject({ activeOrders: 2, comments30d: 0 })
    expect(new Date(member.lastActiveAt).toISOString()).toBe(seen.toISOString())
    // агрегати — лише по цій компанії й публічних коментарях
    expect(db.order.groupBy.mock.calls[0][0].where.companyId).toBe('company-1')
    expect(db.orderComment.groupBy.mock.calls[0][0].where).toMatchObject({
      isInternal: false,
      order: { companyId: 'company-1' },
    })
  })
})
