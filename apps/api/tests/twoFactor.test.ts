import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
// A 32-byte base64 KEK so the envelope crypto works in-test (same key vault uses).
process.env.CREDENTIALS_KEK_BASE64 = Buffer.alloc(32, 7).toString('base64')

const twoFactorFindUnique = vi.fn()
const twoFactorUpsert = vi.fn()
const twoFactorUpdate = vi.fn()
const twoFactorDeleteMany = vi.fn()
const profileFindUnique = vi.fn()
const companyMemberFindMany = vi.fn()
const agencyMemberFindMany = vi.fn()
const refreshCreate = vi.fn()

vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  const db = {
    twoFactorAuth: {
      findUnique: twoFactorFindUnique,
      upsert: twoFactorUpsert,
      update: twoFactorUpdate,
      deleteMany: twoFactorDeleteMany,
    },
    profile: { findUnique: profileFindUnique },
    companyMember: { findMany: companyMemberFindMany },
    agencyMember: { findMany: agencyMemberFindMany },
    refreshToken: { create: refreshCreate },
    // 2FA-POLICY engine probes the agencies of internal members at session-issue
    agency: { findMany: vi.fn().mockResolvedValue([]) },
  }
  return {
    ...actual,
    prisma: db,
    withTenant: (fn: (tx: unknown) => unknown) => fn(db),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
    // verifyChallenge uses prisma.$transaction directly
    enterAgencyContext: vi.fn(),
  }
})
// $transaction lives on the mocked prisma — patch it in after mock resolves.

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { prisma } = (await import('@workflo/db')) as unknown as {
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => unknown }
}
prisma.$transaction = (fn: (tx: unknown) => unknown) =>
  fn({
    // verifyChallenge takes a per-profile advisory lock before the read-modify-write.
    $executeRaw: vi.fn(),
    twoFactorAuth: {
      findUnique: twoFactorFindUnique,
      update: twoFactorUpdate,
    },
  })

const { generateTotpSecret, totpAt } = await import('../src/services/totp.js')
const { encryptTotpSecret } = await import('../src/services/twoFactor.js')

const PROFILE = {
  sub: 'user-1',
  email: 'u@e.com',
  role: 'owner' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'owner' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

/** Build a stored TwoFactorAuth row around a known secret. */
function rowFor(
  secret: string,
  opts: { enabled?: boolean; backupCodes?: string[]; lastTotpStep?: number } = {}
) {
  return {
    profileId: PROFILE.sub,
    ...encryptTotpSecret(secret),
    enabledAt: opts.enabled ? new Date() : null,
    backupCodes: opts.backupCodes ?? [],
    lastTotpStep: opts.lastTotpStep ?? null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  twoFactorUpsert.mockResolvedValue({})
  twoFactorUpdate.mockResolvedValue({})
  twoFactorDeleteMany.mockResolvedValue({ count: 1 })
})
afterEach(() => vi.clearAllMocks())

describe('2FA setup + enable', () => {
  it('setup returns a secret + otpauth URL and upserts a pending row', async () => {
    twoFactorFindUnique.mockResolvedValue(null) // isEnabled → false
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/setup',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(typeof data.secret).toBe('string')
    expect(data.otpauthUrl).toContain('otpauth://totp/Workflo:')
    expect(twoFactorUpsert).toHaveBeenCalled()
    await app.close()
  })

  it('setup is 409 when already enabled', async () => {
    twoFactorFindUnique.mockResolvedValue({ enabledAt: new Date() })
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/setup',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('enable with a valid code flips on and returns backup codes', async () => {
    const secret = generateTotpSecret()
    twoFactorFindUnique.mockResolvedValue(rowFor(secret)) // pending
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/enable',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: totpAt(secret, Date.now()) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.backupCodes).toHaveLength(10)
    expect(twoFactorUpdate.mock.calls[0][0].data.enabledAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('enable with a wrong code is 400 and does not flip on', async () => {
    twoFactorFindUnique.mockResolvedValue(rowFor(generateTotpSecret()))
    const { app, token } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/enable',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '000000' },
    })
    expect(res.statusCode).toBe(400)
    expect(twoFactorUpdate).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('2FA login challenge', () => {
  it('login-verify exchanges a valid challenge + TOTP for a session', async () => {
    const secret = generateTotpSecret()
    const enabledRow = rowFor(secret, { enabled: true })
    twoFactorFindUnique.mockResolvedValue(enabledRow)
    profileFindUnique.mockResolvedValue({
      id: PROFILE.sub,
      email: PROFILE.email,
      role: 'owner',
      name: 'U',
      isActive: true,
      lastActiveAgencyId: null,
    })
    companyMemberFindMany.mockResolvedValue([])
    agencyMemberFindMany.mockResolvedValue([{ agencyId: 'agency-1', role: 'owner' }])
    refreshCreate.mockResolvedValue({ token: 'r', id: 'rt1' })

    const { signChallenge } = await import('../src/routes/auth/twoFactor.js')
    const { app, token: _ } = await authed(PROFILE)
    void _
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/login-verify',
      payload: { challengeToken: signChallenge(PROFILE.sub), code: totpAt(secret, Date.now()) },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().data.accessToken).toBe('string')
    await app.close()
  })

  it('login-verify rejects a forged/expired challenge (401)', async () => {
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/login-verify',
      payload: { challengeToken: 'user-1.1.deadbeef', code: '123456' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('login-verify rejects a wrong code (401)', async () => {
    const secret = generateTotpSecret()
    twoFactorFindUnique.mockResolvedValue(rowFor(secret, { enabled: true }))
    const { signChallenge } = await import('../src/routes/auth/twoFactor.js')
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/login-verify',
      payload: { challengeToken: signChallenge(PROFILE.sub), code: '000000' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('login-verify rejects a replayed TOTP step (already consumed)', async () => {
    const secret = generateTotpSecret()
    const now = Date.now()
    const usedStep = Math.floor(now / 1000 / 30)
    // The row already recorded this step as used → the same code must not work again.
    twoFactorFindUnique.mockResolvedValue(rowFor(secret, { enabled: true, lastTotpStep: usedStep }))
    const { signChallenge } = await import('../src/routes/auth/twoFactor.js')
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/login-verify',
      payload: { challengeToken: signChallenge(PROFILE.sub), code: totpAt(secret, now) },
    })
    expect(res.statusCode).toBe(401)
    expect(twoFactorUpdate).not.toHaveBeenCalled() // step not advanced on a replay
    await app.close()
  })

  it('login-verify accepts a backup code and consumes it', async () => {
    const secret = generateTotpSecret()
    const hash = await bcrypt.hash('abcd-efgh', 10)
    twoFactorFindUnique.mockResolvedValue(rowFor(secret, { enabled: true, backupCodes: [hash] }))
    profileFindUnique.mockResolvedValue({
      id: PROFILE.sub,
      email: PROFILE.email,
      role: 'owner',
      name: 'U',
      isActive: true,
      lastActiveAgencyId: null,
    })
    companyMemberFindMany.mockResolvedValue([])
    agencyMemberFindMany.mockResolvedValue([{ agencyId: 'agency-1', role: 'owner' }])
    refreshCreate.mockResolvedValue({ token: 'r', id: 'rt1' })
    const { signChallenge } = await import('../src/routes/auth/twoFactor.js')
    const { app } = await authed(PROFILE)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/2fa/login-verify',
      payload: { challengeToken: signChallenge(PROFILE.sub), code: 'abcd-efgh' },
    })
    expect(res.statusCode).toBe(200)
    // the used code is removed from the row (single-use)
    expect(twoFactorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { backupCodes: [] } })
    )
    await app.close()
  })
})
