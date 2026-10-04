import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PATCH/DELETE /workspace/clients/:id/members/:profileId — agency-side member mgmt (28-Б).
const db = {
  company: { findFirst: vi.fn(), findUnique: vi.fn() },
  companyMember: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
  profile: { findUnique: vi.fn() },
  invite: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn() },
  passwordResetToken: { create: vi.fn().mockResolvedValue({ id: 'prt-1' }) },
  $executeRaw: vi.fn().mockResolvedValue(1),
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))
const sendCompanyMemberInviteEmail = vi.fn()
vi.mock('../src/services/inviteEmail.js', () => ({ sendCompanyMemberInviteEmail }))
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({ dispatchNotification }))

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OTHER_AGENCY = 'agency-2'
const COMPANY = 'company-1'
const TARGET = 'profile-x'

const OWNER = {
  sub: 'owner-1',
  email: 'o@e.com',
  role: 'owner' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}
const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const memberUrl = `/workspace/clients/${COMPANY}/members/${TARGET}`
const memberRow = {
  role: 'member',
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  profile: { id: TARGET, name: 'Сергій', email: 's@x.com' },
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('PATCH /workspace/clients/:id/members/:profileId — change role', () => {
  it('owner promotes a member to owner', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'member' })
    db.companyMember.update.mockResolvedValue({ ...memberRow, role: 'owner' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.member).toMatchObject({ profileId: TARGET, role: 'owner' })
    expect(db.companyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_profileId: { companyId: COMPANY, profileId: TARGET } },
        data: { role: 'owner' },
      })
    )
    await app.close()
  })

  it('refuses to demote the last owner (409)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'owner' })
    db.companyMember.count.mockResolvedValue(1) // only owner
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'member' },
    })
    expect(res.statusCode).toBe(409)
    expect(db.companyMember.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('demotes an owner when others remain', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'owner' })
    db.companyMember.count.mockResolvedValue(2)
    db.companyMember.update.mockResolvedValue({ ...memberRow, role: 'member' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'member' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('is 404 for a company in another tenant', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('a non-owner (executor) is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an invalid role (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'superadmin' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('returns 401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await app.inject({ method: 'PATCH', url: memberUrl, payload: { role: 'owner' } })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('POST /workspace/clients/:id/members/invite — invite on-behalf', () => {
  const inviteUrl = `/workspace/clients/${COMPANY}/members/invite`

  it('owner invites a brand-new email (201 + email sent)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY, name: 'Acme' })
    db.profile.findUnique.mockResolvedValue(null) // no existing profile / inviter lookup → fallback
    db.invite.create.mockResolvedValue({
      id: 'inv-1',
      token: 'tok',
      expiresAt: new Date('2026-02-01T00:00:00Z'),
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: inviteUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'New.Person@X.com' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({ inviteId: 'inv-1', email: 'new.person@x.com' })
    // supersede prior pending invites before issuing the new one
    expect(db.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'new.person@x.com', usedAt: null }),
      })
    )
    expect(db.invite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new.person@x.com', type: 'company_member' }),
      })
    )
    expect(sendCompanyMemberInviteEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ to: 'new.person@x.com', companyName: 'Acme' })
    )
    await app.close()
  })

  it('is 409 when the email already belongs to a member', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY, name: 'Acme' })
    db.profile.findUnique.mockResolvedValue({ id: TARGET })
    db.companyMember.findUnique.mockResolvedValue({ companyId: COMPANY })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: inviteUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 's@x.com' },
    })
    expect(res.statusCode).toBe(409)
    expect(db.invite.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('is 404 for a company in another tenant', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: inviteUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(404)
    expect(db.invite.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('a non-owner (executor) is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: inviteUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects a malformed email (400)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: inviteUrl,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('POST /workspace/clients/:id/members/:profileId/reset-password — on-behalf', () => {
  const resetUrl = `/workspace/clients/${COMPANY}/members/${TARGET}/reset-password`

  it('owner triggers a reset for an active member (200 + token + notification)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({
      profile: { id: TARGET, email: 's@x.com', isActive: true },
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: resetUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 's@x.com' }) })
    )
    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ profileId: TARGET, event: 'auth.password_reset' })
    )
    await app.close()
  })

  it('is a silent no-op for an inactive member (200, no token/notification)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({
      profile: { id: TARGET, email: 's@x.com', isActive: false },
    })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: resetUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.passwordResetToken.create).not.toHaveBeenCalled()
    expect(dispatchNotification).not.toHaveBeenCalled()
    await app.close()
  })

  it('is 404 when the profile is not a member of this company', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: resetUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(db.passwordResetToken.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('is 404 for a company in another tenant', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: resetUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('a non-owner (executor) is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: resetUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('DELETE /workspace/clients/:id/members/:profileId — remove', () => {
  it('owner removes a member', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'member' })
    db.companyMember.delete.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ removed: TARGET })
    expect(db.companyMember.delete).toHaveBeenCalledWith({
      where: { companyId_profileId: { companyId: COMPANY, profileId: TARGET } },
    })
    await app.close()
  })

  it('refuses to remove the last owner (409)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.companyMember.findUnique.mockResolvedValue({ role: 'owner' })
    db.companyMember.count.mockResolvedValue(1)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    expect(db.companyMember.delete).not.toHaveBeenCalled()
    await app.close()
  })

  it('a non-owner is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: memberUrl,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })
})
