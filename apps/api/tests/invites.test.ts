import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.PORTAL_URL = 'https://portal.test'
process.env.WORKSPACE_URL = 'https://work.test'

const inviteCreate = vi.fn()
const inviteUpdate = vi.fn()
const inviteUpdateMany = vi.fn()
const inviteFindUnique = vi.fn()
const profileFindUnique = vi.fn()
const profileUpdate = vi.fn()
const companyFindUnique = vi.fn()
const companyMemberFindUnique = vi.fn()
const companyMemberUpsert = vi.fn()
const agencyMemberUpsert = vi.fn()
const auditLogCreate = vi.fn()
const transaction = vi.fn()
const notifyRecipient = vi.fn().mockResolvedValue({
  results: [{ channel: 'email', result: { status: 'sent' } }],
  attempted: ['email'],
})

vi.mock('@workflo/db', () => ({
  prisma: {
    invite: {
      create: inviteCreate,
      update: inviteUpdate,
      updateMany: inviteUpdateMany,
      findUnique: inviteFindUnique,
    },
    profile: { findUnique: profileFindUnique, update: profileUpdate },
    company: { findUnique: companyFindUnique },
    companyMember: { findUnique: companyMemberFindUnique, upsert: companyMemberUpsert },
    agencyMember: { upsert: agencyMemberUpsert },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

// Stub notifications — inviteEmail.ts uses notifyRecipient (profile-less, D2).
vi.mock('@workflo/notifications', () => ({
  notify: vi.fn(),
  notifyRecipient,
}))

const { buildApp } = await import('../src/app.js')

function tokenFor(app: Awaited<ReturnType<typeof buildApp>>, claims: Record<string, unknown>) {
  return app.jwt.sign(claims as never)
}

const EXECUTOR_CLAIMS = {
  sub: 'exec-1',
  email: 'exec@workflo.space',
  role: 'executor',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
  memberships: [],
}
const OWNER_CLAIMS = {
  sub: 'owner-1',
  email: 'owner@e.com',
  role: 'client',
  activeCompanyId: 'company-1',
  memberships: [{ companyId: 'company-1', role: 'owner' }],
}
const MEMBER_CLAIMS = {
  sub: 'member-1',
  email: 'member@e.com',
  role: 'client',
  activeCompanyId: 'company-2',
  memberships: [{ companyId: 'company-2', role: 'member' }],
}

describe('POST /workspace/team/invite (executor)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ invite: { updateMany: inviteUpdateMany, create: inviteCreate } })
    )
  })
  afterEach(() => vi.clearAllMocks())

  it('executor can invite → 201, supersedes old, sends email', async () => {
    inviteUpdateMany.mockResolvedValue({ count: 0 })
    inviteCreate.mockResolvedValue({ id: 'inv-1', token: 'tok-1', expiresAt: new Date() })
    profileFindUnique.mockResolvedValue({ name: 'Admin' })
    auditLogCreate.mockResolvedValue({})
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/team/invite',
      headers: { authorization: `Bearer ${tokenFor(app, EXECUTOR_CLAIMS)}` },
      payload: { email: 'New@Exec.com' },
    })
    expect(res.statusCode).toBe(201)
    expect(inviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'executor', email: 'new@exec.com' }),
      })
    )
    expect(notifyRecipient).toHaveBeenCalledOnce()
    await app.close()
  })

  it('non-executor (client) → 403', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/team/invite',
      headers: { authorization: `Bearer ${tokenFor(app, OWNER_CLAIMS)}` },
      payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(403)
    expect(inviteCreate).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /company/members/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({ invite: { updateMany: inviteUpdateMany, create: inviteCreate } })
    )
  })
  afterEach(() => vi.clearAllMocks())

  it('company owner invites → 201', async () => {
    companyFindUnique.mockResolvedValue({ id: 'company-1', name: 'Acme' })
    profileFindUnique.mockResolvedValue(null) // invitee has no account yet
    inviteUpdateMany.mockResolvedValue({ count: 0 })
    inviteCreate.mockResolvedValue({ id: 'inv-2', token: 'tok-2', expiresAt: new Date() })
    auditLogCreate.mockResolvedValue({})
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/company/members/invite',
      headers: { authorization: `Bearer ${tokenFor(app, OWNER_CLAIMS)}` },
      payload: { email: 'invitee@e.com' },
    })
    expect(res.statusCode).toBe(201)
    expect(notifyRecipient).toHaveBeenCalledOnce()
    await app.close()
  })

  it('member (not owner) → 403', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/company/members/invite',
      headers: { authorization: `Bearer ${tokenFor(app, MEMBER_CLAIMS)}` },
      // companyId omitted → falls back to activeCompanyId (company-2) where the
      // user is only a 'member' → authz denies before any DB work.
      payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('409 when invitee already a member', async () => {
    companyFindUnique.mockResolvedValue({ id: 'company-1', name: 'Acme' })
    profileFindUnique.mockResolvedValue({ id: 'existing-1' })
    companyMemberFindUnique.mockResolvedValue({ id: 'cm-1' })
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/company/members/invite',
      headers: { authorization: `Bearer ${tokenFor(app, OWNER_CLAIMS)}` },
      payload: { email: 'existing@e.com' },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })
})

describe('GET /invite/:token (public)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns pending invite details', async () => {
    inviteFindUnique.mockResolvedValue({
      email: 'i@e.com',
      type: 'company_member',
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      companyId: 'company-1',
      invitedBy: { name: 'Owner' },
    })
    companyFindUnique.mockResolvedValue({ name: 'Acme' })
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/invite/tok-1' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.status).toBe('pending')
    expect(body.data.companyName).toBe('Acme')
    expect(body.data.inviterName).toBe('Owner')
    await app.close()
  })

  it('derives status=expired', async () => {
    inviteFindUnique.mockResolvedValue({
      email: 'i@e.com',
      type: 'executor',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      companyId: null,
      invitedBy: { name: 'Admin' },
    })
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/invite/tok-1' })
    expect(res.json().data.status).toBe('expired')
    await app.close()
  })

  it('404 unknown token', async () => {
    inviteFindUnique.mockResolvedValue(null)
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/invite/nope' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('POST /invite/:token/accept', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('company_member accept → creates membership, marks used', async () => {
    inviteFindUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'member@e.com',
      type: 'company_member',
      companyId: 'company-9',
      permissions: {},
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    })
    profileFindUnique.mockResolvedValue({ id: 'member-1', email: 'member@e.com' })
    inviteUpdateMany.mockResolvedValue({ count: 1 }) // atomic claim succeeds
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        companyMember: { upsert: companyMemberUpsert },
        invite: { updateMany: inviteUpdateMany },
      })
    )
    auditLogCreate.mockResolvedValue({})
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/invite/tok-1/accept',
      headers: { authorization: `Bearer ${tokenFor(app, MEMBER_CLAIMS)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.type).toBe('company_member')
    expect(companyMemberUpsert).toHaveBeenCalled()
    await app.close()
  })

  it('executor accept → creates AgencyMember(role=executor) + sets Profile.role, marks used (R-1)', async () => {
    inviteFindUnique.mockResolvedValue({
      id: 'inv-x',
      agencyId: 'agency-1',
      email: 'exec@workflo.space',
      type: 'executor',
      companyId: null,
      permissions: null,
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    })
    profileFindUnique.mockResolvedValue({ id: 'exec-1', email: 'exec@workflo.space' })
    inviteUpdateMany.mockResolvedValue({ count: 1 })
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        invite: { updateMany: inviteUpdateMany },
        agencyMember: { upsert: agencyMemberUpsert },
        profile: { update: profileUpdate },
      })
    )
    auditLogCreate.mockResolvedValue({})
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/invite/tok-x/accept',
      headers: { authorization: `Bearer ${tokenFor(app, EXECUTOR_CLAIMS)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.type).toBe('executor')
    // The authoritative signal isInternalTeam reads — must be created.
    expect(agencyMemberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId_profileId: { agencyId: 'agency-1', profileId: 'exec-1' } },
        create: { agencyId: 'agency-1', profileId: 'exec-1', role: 'executor' },
      })
    )
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: { role: 'executor' },
    })
    await app.close()
  })

  it('executor accept with no agencyId on the invite → 410 (never lock the user out)', async () => {
    inviteFindUnique.mockResolvedValue({
      id: 'inv-x',
      agencyId: null,
      email: 'exec@workflo.space',
      type: 'executor',
      companyId: null,
      permissions: null,
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    })
    profileFindUnique.mockResolvedValue({ id: 'exec-1', email: 'exec@workflo.space' })
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/invite/tok-x/accept',
      headers: { authorization: `Bearer ${tokenFor(app, EXECUTOR_CLAIMS)}` },
    })
    expect(res.statusCode).toBe(410)
    expect(agencyMemberUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('403 when invite email ≠ authenticated user email', async () => {
    inviteFindUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'someone-else@e.com',
      type: 'company_member',
      companyId: 'company-9',
      permissions: {},
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    })
    profileFindUnique.mockResolvedValue({ id: 'member-1', email: 'member@e.com' })
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/invite/tok-1/accept',
      headers: { authorization: `Bearer ${tokenFor(app, MEMBER_CLAIMS)}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('410 for a used invite', async () => {
    inviteFindUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'member@e.com',
      type: 'company_member',
      companyId: 'company-9',
      permissions: {},
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
    })
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/invite/tok-1/accept',
      headers: { authorization: `Bearer ${tokenFor(app, MEMBER_CLAIMS)}` },
    })
    expect(res.statusCode).toBe(410)
    await app.close()
  })

  it('401 without a token', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/invite/tok-1/accept' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
