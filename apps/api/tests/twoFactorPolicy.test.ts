import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.CREDENTIALS_KEK_BASE64 = Buffer.alloc(32, 7).toString('base64')

// 2FA-POLICY (рішення власника 05.07): owner toggle + tfaDue gate + TOTP-first step-up.
const db = {
  agency: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
  twoFactorAuth: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
  profile: { findUnique: vi.fn() },
  credentialVault: { findMany: vi.fn() },
  credentialShare: { findMany: vi.fn().mockResolvedValue([]) },
  auditLog: { count: vi.fn().mockResolvedValue(0) },
  company: { findFirst: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn().mockResolvedValue(1),
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
const writeAuditAsync = vi.fn()
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync }))
const verifyPassword = vi.fn()
vi.mock('../src/auth/password.js', () => ({ verifyPassword }))
// TOTP verification is unit-tested in totp/twoFactor suites — stub the challenge here.
const isEnabled = vi.fn()
const verifyChallenge = vi.fn()
vi.mock('../src/services/twoFactor.js', () => ({ isEnabled, verifyChallenge }))

const { buildApp } = await import('../src/app.js')
const { twoFactorSetupState, TFA_GRACE_MS } = await import('../src/services/twoFactorPolicy.js')

const AGENCY = 'agency-1'
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
  ...OWNER,
  sub: 'exec-1',
  role: 'executor' as const,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

beforeEach(() => {
  vi.clearAllMocks()
  isEnabled.mockResolvedValue(false)
})
afterEach(() => vi.clearAllMocks())

describe('twoFactorSetupState (policy engine)', () => {
  it('portal client (no agency memberships) is never gated', async () => {
    const s = await twoFactorSetupState('client-1', [])
    expect(s).toEqual({ required: false, deadline: null, blocking: false })
    expect(db.agency.findMany).not.toHaveBeenCalled()
  })

  it('policy off → not required', async () => {
    db.agency.findMany.mockResolvedValue([])
    const s = await twoFactorSetupState('exec-1', EXECUTOR.agencyMemberships)
    expect(s.required).toBe(false)
  })

  it('policy on + 2FA already enabled → not required', async () => {
    db.agency.findMany.mockResolvedValue([{ requireTwoFactorAt: new Date() }])
    isEnabled.mockResolvedValue(true)
    const s = await twoFactorSetupState('exec-1', EXECUTOR.agencyMemberships)
    expect(s.required).toBe(false)
  })

  it('inside grace → required but NOT blocking, deadline = enable+7d', async () => {
    const since = new Date()
    db.agency.findMany.mockResolvedValue([{ requireTwoFactorAt: since }])
    const s = await twoFactorSetupState('exec-1', EXECUTOR.agencyMemberships)
    expect(s.required).toBe(true)
    expect(s.blocking).toBe(false)
    expect(new Date(s.deadline!).getTime()).toBe(since.getTime() + TFA_GRACE_MS)
  })

  it('past grace → blocking', async () => {
    db.agency.findMany.mockResolvedValue([
      { requireTwoFactorAt: new Date(Date.now() - TFA_GRACE_MS - 1000) },
    ])
    const s = await twoFactorSetupState('exec-1', EXECUTOR.agencyMemberships)
    expect(s.blocking).toBe(true)
  })
})

describe('authenticate gate (tfaDue claim)', () => {
  it('tfaDue session gets 403 TFA_SETUP_REQUIRED outside /auth/*', async () => {
    const { app } = await authed(OWNER)
    const token = app.jwt.sign({ ...EXECUTOR, tfaDue: true } as object)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/vault',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('TFA_SETUP_REQUIRED')
    await app.close()
  })

  it('tfaDue session still reaches /auth/* (2FA setup lives there)', async () => {
    db.twoFactorAuth.findUnique.mockResolvedValue(null)
    const { app } = await authed(OWNER)
    const token = app.jwt.sign({ ...EXECUTOR, tfaDue: true } as object)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/2fa/status',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('PATCH/GET /workspace/agency/security — owner toggle', () => {
  it('owner enables the policy (stamps requireTwoFactorAt, deadline +7d, audited)', async () => {
    db.agency.update.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/agency/security',
      headers: { authorization: `Bearer ${token}` },
      payload: { requireTwoFactor: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.requireTwoFactor).toBe(true)
    expect(res.json().data.deadline).not.toBeNull()
    const audit = writeAuditAsync.mock.calls[0]![1] as { action: string }
    expect(audit.action).toBe('agency.2fa_policy_enabled')
    await app.close()
  })

  it('executor cannot toggle (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/agency/security',
      headers: { authorization: `Bearer ${token}` },
      payload: { requireTwoFactor: true },
    })
    expect(res.statusCode).toBe(403)
    expect(db.agency.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET returns coverage: who of the team has 2FA', async () => {
    db.agency.findUnique.mockResolvedValue({ requireTwoFactorAt: new Date() })
    db.agencyMember.findMany.mockResolvedValue([
      { profileId: 'owner-1', profile: { name: 'Owner' } },
      { profileId: 'exec-1', profile: { name: 'Exec' } },
    ])
    db.twoFactorAuth.findMany.mockResolvedValue([{ profileId: 'owner-1' }])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/agency/security',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const members = res.json().data.members as { profileId: string; twoFactorEnabled: boolean }[]
    expect(members.find((m) => m.profileId === 'owner-1')!.twoFactorEnabled).toBe(true)
    expect(members.find((m) => m.profileId === 'exec-1')!.twoFactorEnabled).toBe(false)
    await app.close()
  })
})

describe('TOTP-first step-up (vault reveal)', () => {
  it('2FA on: password is refused (400 «введіть код»), valid code mints a grant', async () => {
    isEnabled.mockResolvedValue(true)
    verifyChallenge.mockResolvedValue('ok')
    const { app, token } = await authed(OWNER)
    const pw = await app.inject({
      method: 'POST',
      url: '/workspace/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'hunter2' },
    })
    expect(pw.statusCode).toBe(400)
    expect(pw.json().error.message).toContain('код')

    const code = await app.inject({
      method: 'POST',
      url: '/workspace/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '123456' },
    })
    expect(code.statusCode).toBe(200)
    expect(code.json().data.grant).toContain(OWNER.sub)
    expect(verifyChallenge).toHaveBeenCalledWith(OWNER.sub, '123456')
    await app.close()
  })

  it('2FA on: wrong code → 401 + step_up_failed audit', async () => {
    isEnabled.mockResolvedValue(true)
    verifyChallenge.mockResolvedValue('invalid')
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '000000' },
    })
    expect(res.statusCode).toBe(401)
    const audit = writeAuditAsync.mock.calls[0]![1] as {
      action: string
      metadata: { reason: string }
    }
    expect(audit.action).toBe('credentials.step_up_failed')
    expect(audit.metadata.reason).toBe('bad_code')
    await app.close()
  })

  it('2FA off: password fallback still works (workspace + portal)', async () => {
    isEnabled.mockResolvedValue(false)
    verifyPassword.mockResolvedValue(true)
    db.profile.findUnique.mockResolvedValue({
      passwordHash: 'hash',
      emailVerifiedAt: new Date(),
    })
    const { app, token } = await authed(OWNER)
    const ws = await app.inject({
      method: 'POST',
      url: '/workspace/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'pw' },
    })
    expect(ws.statusCode).toBe(200)

    const CLIENT = {
      ...OWNER,
      sub: 'client-1',
      role: 'client' as const,
      agencyMemberships: [],
      activeCompanyId: 'company-1',
      memberships: [{ companyId: 'company-1', role: 'owner' as const }],
    }
    const ptoken = app.jwt.sign(CLIENT as object)
    const portal = await app.inject({
      method: 'POST',
      url: '/portal/vault/step-up',
      headers: { authorization: `Bearer ${ptoken}` },
      payload: { password: 'pw' },
    })
    expect(portal.statusCode).toBe(200)
    await app.close()
  })

  it('empty body → 400 (потрібен пароль або код)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
