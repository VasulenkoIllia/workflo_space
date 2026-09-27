import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PERM-1: керування правами (owner-only) + резолвер requirePermission.
const roleFindMany = vi.fn()
const roleUpsert = vi.fn()
const roleDeleteMany = vi.fn()
const memberPermFindMany = vi.fn()
const memberPermUpsert = vi.fn()
const memberPermDeleteMany = vi.fn()
const memberFindUnique = vi.fn()
const memberFindMany = vi.fn()
const teamFindMany = vi.fn()

const db = {
  agencyRolePermission: { findMany: roleFindMany, upsert: roleUpsert, deleteMany: roleDeleteMany },
  agencyMemberPermission: {
    findMany: memberPermFindMany,
    upsert: memberPermUpsert,
    deleteMany: memberPermDeleteMany,
  },
  agencyMember: { findUnique: memberFindUnique, findMany: memberFindMany },
  team: { findMany: teamFindMany },
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
const { fetchPermissionData } = await import('../src/auth/permissionStore.js')
const { invalidatePermissions, requirePermission } = await import('../src/auth/permissions.js')

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
const MANAGER = {
  ...OWNER,
  sub: 'mgr-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
}
const EXECUTOR = {
  ...OWNER,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidatePermissions(AGENCY)
})
afterEach(() => vi.clearAllMocks())

describe('PERM-1 /workspace/permissions (керування — лише власник)', () => {
  it('власник читає матрицю відхилень + людей з тімлідством', async () => {
    roleFindMany.mockResolvedValue([{ role: 'manager', permission: 'billing.view', level: 'all' }])
    memberPermFindMany.mockResolvedValue([
      { profileId: 'exec-1', permission: 'content.manage', level: 'all' },
    ])
    memberFindMany.mockResolvedValue([
      { profileId: 'owner-1', role: 'owner', profile: { name: 'O' } },
      { profileId: 'exec-1', role: 'executor', profile: { name: 'E' } },
    ])
    teamFindMany.mockResolvedValue([{ leadId: 'exec-1' }])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/permissions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.roleOverrides).toHaveLength(1)
    const exec = data.members.find((m: { profileId: string }) => m.profileId === 'exec-1')
    expect(exec.isLead).toBe(true)
    expect(exec.overrides).toEqual([{ permission: 'content.manage', level: 'all' }])
    await app.close()
  })

  it('менеджер і виконавець — 403 (самопідвищення неможливе)', async () => {
    for (const who of [MANAGER, EXECUTOR]) {
      const { app, token } = await authed(who)
      const get = await app.inject({
        method: 'GET',
        url: '/workspace/permissions',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(get.statusCode).toBe(403)
      const put = await app.inject({
        method: 'PUT',
        url: `/workspace/permissions/members/${who.sub}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { permission: 'billing.view', level: 'all' },
      })
      expect(put.statusCode).toBe(403)
      await app.close()
    }
    expect(memberPermUpsert).not.toHaveBeenCalled()
  })

  it('рядок матриці: upsert рівня; level:null — скидання до дефолту', async () => {
    const { app, token } = await authed(OWNER)
    const set = await app.inject({
      method: 'PUT',
      url: '/workspace/permissions/roles/manager',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'billing.view', level: 'all' },
    })
    expect(set.statusCode).toBe(200)
    expect(roleUpsert.mock.calls[0][0].create).toMatchObject({
      agencyId: AGENCY,
      role: 'manager',
      permission: 'billing.view',
      level: 'all',
    })
    const reset = await app.inject({
      method: 'PUT',
      url: '/workspace/permissions/roles/manager',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'billing.view', level: null },
    })
    expect(reset.statusCode).toBe(200)
    expect(roleDeleteMany).toHaveBeenCalledWith({
      where: { agencyId: AGENCY, role: 'manager', permission: 'billing.view' },
    })
    await app.close()
  })

  it('400: невідоме право / невідома роль; власника персонально не обмежити', async () => {
    const { app, token } = await authed(OWNER)
    const badPerm = await app.inject({
      method: 'PUT',
      url: '/workspace/permissions/roles/manager',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'root.all', level: 'all' },
    })
    expect(badPerm.statusCode).toBe(400)
    const badRole = await app.inject({
      method: 'PUT',
      url: '/workspace/permissions/roles/owner',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'billing.view', level: 'none' },
    })
    expect(badRole.statusCode).toBe(400)
    memberFindUnique.mockResolvedValue({ role: 'owner' })
    const ownerTarget = await app.inject({
      method: 'PUT',
      url: '/workspace/permissions/members/owner-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'billing.view', level: 'none' },
    })
    expect(ownerTarget.statusCode).toBe(400)
    memberFindUnique.mockResolvedValue(null)
    const stranger = await app.inject({
      method: 'PUT',
      url: '/workspace/permissions/members/nobody',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'billing.view', level: 'all' },
    })
    expect(stranger.statusCode).toBe(404)
    expect(roleUpsert).not.toHaveBeenCalled()
    expect(memberPermUpsert).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('PERM-1 requirePermission (резолвер)', () => {
  const req = (user: object) => ({ user }) as never

  it('дефолт: менеджер без billing.view → 403; з рядком матриці → пропускає', async () => {
    await expect(requirePermission(req(MANAGER), 'billing.view')).rejects.toMatchObject({
      statusCode: 403,
    })
    invalidatePermissions(AGENCY)
    vi.mocked(fetchPermissionData).mockResolvedValueOnce({
      leadTeamIds: [],
      teamId: null,
      roleRows: [{ role: 'manager', permission: 'billing.view', level: 'all' }],
      memberRows: [],
    })
    await expect(requirePermission(req(MANAGER), 'billing.view')).resolves.toMatchObject({
      level: 'all',
    })
  })

  it('тімлід: orders.accept = team; min all → 403', async () => {
    vi.mocked(fetchPermissionData).mockResolvedValueOnce({
      leadTeamIds: ['team-1'],
      teamId: 'team-1',
      roleRows: [],
      memberRows: [],
    })
    const snap = await requirePermission(req(EXECUTOR), 'orders.accept')
    expect(snap.level).toBe('team')
    expect(snap.isLead).toBe(true)
    await expect(requirePermission(req(EXECUTOR), 'orders.accept', 'all')).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('клієнт порталу (не член агенції) — усе none', async () => {
    const client = { ...OWNER, sub: 'c-1', agencyMemberships: [] }
    await expect(requirePermission(req(client), 'orders.view')).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
