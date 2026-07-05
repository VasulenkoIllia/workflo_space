import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.CREDENTIALS_KEK_BASE64 = Buffer.alloc(32, 7).toString('base64')

// Credentials Vault — portal self-service (17-А + 17-Б client journal). Real crypto.
const db = {
  credentialVault: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
  profile: { findUnique: vi.fn() },
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

const { buildApp } = await import('../src/app.js')
const { encryptSecret, getKek } = await import('../src/services/credentialCrypto.js')
const { issueRevealGrant } = await import('../src/services/vaultGrant.js')

const AGENCY = 'agency-1'
const COMPANY = 'company-1'
const CRED = 'cred-1'

// Client company OWNER — the only portal role with vault access (can credentials.*).
const CLIENT_OWNER = {
  sub: 'client-1',
  email: 'c@e.com',
  role: 'client' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: COMPANY,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: COMPANY, role: 'owner' as const }],
}
const CLIENT_MEMBER = {
  ...CLIENT_OWNER,
  sub: 'member-1',
  memberships: [{ companyId: COMPANY, role: 'member' as const }],
}
const NO_COMPANY = { ...CLIENT_OWNER, sub: 'lost-1', activeCompanyId: null, memberships: [] }

const GRANT = () => issueRevealGrant(CLIENT_OWNER.sub).grant

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const metaRow = {
  id: CRED,
  label: 'FTP сайту',
  service: 'ftp',
  url: 'ftp://host',
  username: 'deploy',
  notes: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdById: CLIENT_OWNER.sub,
}

/** profile.findUnique serves BOTH the email-gate (emailVerifiedAt) and step-up (passwordHash). */
const verifiedProfile = () =>
  db.profile.findUnique.mockResolvedValue({
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash: 'hash',
  })

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /portal/credentials — list', () => {
  it('company owner lists metadata with mine-flag, no ciphertext', async () => {
    db.credentialVault.findMany.mockResolvedValue([
      metaRow,
      { ...metaRow, id: 'cred-2', createdById: 'agency-owner-1' },
    ])
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const creds = res.json().data.credentials as { id: string; mine: boolean }[]
    expect(creds).toHaveLength(2)
    expect(creds[0]!.mine).toBe(true)
    expect(creds[1]!.mine).toBe(false)
    expect(JSON.stringify(res.json())).not.toContain('ciphertext')
    // scoped to the ACTIVE company only
    expect(db.credentialVault.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY } })
    )
    await app.close()
  })

  it('company MEMBER (not owner) is forbidden (403)', async () => {
    const { app, token } = await authed(CLIENT_MEMBER)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.credentialVault.findMany).not.toHaveBeenCalled()
    await app.close()
  })

  it('no active company → 400', async () => {
    const { app, token } = await authed(NO_COMPANY)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('401 without a token', async () => {
    const { app } = await authed(CLIENT_OWNER)
    const res = await app.inject({ method: 'GET', url: '/portal/credentials' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('POST /portal/credentials — client adds a secret (17-А)', () => {
  it('creates encrypted, bound to the active company, audited via portal', async () => {
    verifiedProfile()
    db.credentialVault.create.mockResolvedValue(metaRow)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'FTP сайту', service: 'ftp', secret: 'p@ss' },
    })
    expect(res.statusCode).toBe(201)
    const arg = db.credentialVault.create.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(arg.data.companyId).toBe(COMPANY)
    expect(arg.data.agencyId).toBe(AGENCY)
    expect(arg.data.createdById).toBe(CLIENT_OWNER.sub)
    expect(arg.data.ciphertext).toBeInstanceOf(Buffer)
    expect(JSON.stringify(res.json())).not.toContain('p@ss')
    const audit = writeAuditAsync.mock.calls[0]![1] as { metadata: { via: string } }
    expect(audit.metadata.via).toBe('portal')
    await app.close()
  })

  it('UNVERIFIED email → 403, nothing written (S9 gate)', async () => {
    db.profile.findUnique.mockResolvedValue({ emailVerifiedAt: null, passwordHash: 'hash' })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'X', secret: 's' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('email')
    expect(db.credentialVault.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('member cannot create (403)', async () => {
    const { app, token } = await authed(CLIENT_MEMBER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'X', secret: 's' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.credentialVault.create).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /portal/vault/step-up + reveal', () => {
  it('step-up mints a grant on the correct password', async () => {
    verifiedProfile()
    verifyPassword.mockResolvedValue(true)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'pw' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.grant).toContain(CLIENT_OWNER.sub)
    expect(res.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  it('step-up rejects a wrong password (401) and audits the failure', async () => {
    verifiedProfile()
    verifyPassword.mockResolvedValue(false)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/vault/step-up',
      headers: { authorization: `Bearer ${token}` },
      payload: { password: 'nope' },
    })
    expect(res.statusCode).toBe(401)
    const audit = writeAuditAsync.mock.calls[0]![1] as { action: string }
    expect(audit.action).toBe('credentials.step_up_failed')
    await app.close()
  })

  it('reveal WITHOUT a grant → 403 STEP_UP_REQUIRED, no decrypt', async () => {
    verifiedProfile()
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('STEP_UP_REQUIRED')
    expect(db.credentialVault.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('reveal with a live grant decrypts, audits via portal, no-store', async () => {
    verifiedProfile()
    const enc = encryptSecret('super-secret', getKek()!)
    db.credentialVault.findFirst.mockResolvedValue({ id: CRED, revokedAt: null, ...enc })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant: GRANT() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.secret).toBe('super-secret')
    expect(res.headers['cache-control']).toBe('no-store')
    // secret scoped to the active company (not a foreign credId ride-along)
    expect(db.credentialVault.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CRED, companyId: COMPANY } })
    )
    const audit = writeAuditAsync.mock.calls[0]![1] as {
      action: string
      metadata: { via: string }
    }
    expect(audit.action).toBe('credentials.revealed')
    expect(audit.metadata.via).toBe('portal')
    await app.close()
  })

  it('reveal of a revoked secret → 409', async () => {
    verifiedProfile()
    db.credentialVault.findFirst.mockResolvedValue({ id: CRED, revokedAt: new Date() })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant: GRANT() },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('reveal is throttled after the hourly budget (429)', async () => {
    verifiedProfile()
    db.auditLog.count.mockResolvedValue(10)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant: GRANT() },
    })
    expect(res.statusCode).toBe(429)
    expect(db.credentialVault.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('reveal with UNVERIFIED email → 403 before any grant check', async () => {
    db.profile.findUnique.mockResolvedValue({ emailVerifiedAt: null })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant: GRANT() },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('email')
    await app.close()
  })
})

describe('revoke / delete', () => {
  it('client revokes ANY company secret (also agency-created)', async () => {
    verifiedProfile()
    db.credentialVault.updateMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.credentialVault.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CRED, companyId: COMPANY, revokedAt: null } })
    )
    await app.close()
  })

  it('delete succeeds only for own rows (createdById scoped)', async () => {
    verifiedProfile()
    db.credentialVault.deleteMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `/portal/credentials/${CRED}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(db.credentialVault.deleteMany).toHaveBeenCalledWith({
      where: { id: CRED, companyId: COMPANY, createdById: CLIENT_OWNER.sub },
    })
    await app.close()
  })

  it('deleting an agency-created secret → 403 with an honest message', async () => {
    verifiedProfile()
    db.credentialVault.deleteMany.mockResolvedValue({ count: 0 })
    db.credentialVault.findFirst.mockResolvedValue({ id: CRED }) // exists but not mine
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `/portal/credentials/${CRED}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('deleting a missing secret → 404', async () => {
    verifiedProfile()
    db.credentialVault.deleteMany.mockResolvedValue({ count: 0 })
    db.credentialVault.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `/portal/credentials/${CRED}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('GET /portal/credentials/:credId/audit — client journal (17-Б)', () => {
  it('returns WHO/WHEN without IP or user-agent', async () => {
    db.credentialVault.findFirst.mockResolvedValue({ id: CRED })
    db.auditLog.findMany.mockResolvedValue([
      {
        id: 'a-1',
        action: 'credentials.revealed',
        result: 'allowed',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        actor: { name: 'Owner Agency' },
        metadata: { ip: '1.2.3.4', userAgent: 'curl' },
      },
    ])
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/portal/credentials/${CRED}/audit`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const entry = res.json().data.entries[0] as Record<string, unknown>
    expect(entry.actorName).toBe('Owner Agency')
    expect(JSON.stringify(res.json())).not.toContain('1.2.3.4')
    expect(JSON.stringify(res.json())).not.toContain('curl')
    await app.close()
  })

  it('404 for a secret outside the active company', async () => {
    db.credentialVault.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `/portal/credentials/cred-foreign/audit`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(db.auditLog.findMany).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('17-Д typed templates (portal)', () => {
  it('typed create splits fields: public plain, secret encrypted as JSON', async () => {
    verifiedProfile()
    db.credentialVault.create.mockResolvedValue({
      ...metaRow,
      resourceType: 'server',
      publicFields: [{ kind: 'url', value: 'ssh://1.2.3.4' }],
    })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: '1С сервер',
        resourceType: 'server',
        fields: [
          { kind: 'url', value: 'ssh://1.2.3.4' },
          { kind: 'login', value: 'root' },
          { kind: 'password', value: 'sup3r' },
          { kind: 'token', value: 'tok_123' },
        ],
      },
    })
    expect(res.statusCode).toBe(201)
    const arg = db.credentialVault.create.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(arg.data.resourceType).toBe('server')
    expect(arg.data.service).toBe('server')
    // public half stored plain, secret half NOT among plain fields
    expect(arg.data.publicFields).toEqual([
      { kind: 'url', value: 'ssh://1.2.3.4' },
      { kind: 'login', value: 'root' },
    ])
    expect(arg.data.ciphertext).toBeInstanceOf(Buffer)
    const plainJson = JSON.stringify(arg.data.publicFields)
    expect(plainJson).not.toContain('sup3r')
    expect(plainJson).not.toContain('tok_123')
    expect(JSON.stringify(res.json())).not.toContain('sup3r')
    await app.close()
  })

  it('typed create with NO secret field → 400 (a vault card must protect something)', async () => {
    verifiedProfile()
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Public only',
        resourceType: 'crm',
        fields: [{ kind: 'url', value: 'https://x' }],
      },
    })
    expect(res.statusCode).toBe(400)
    expect(db.credentialVault.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('typed create with an unknown kind / type → 400', async () => {
    verifiedProfile()
    const { app, token } = await authed(CLIENT_OWNER)
    const bad1 = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'X',
        resourceType: 'spaceship',
        fields: [{ kind: 'password', value: 'p' }],
      },
    })
    expect(bad1.statusCode).toBe(400)
    const bad2 = await app.inject({
      method: 'POST',
      url: '/portal/credentials',
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'X', resourceType: 'crm', fields: [{ kind: 'pin_code', value: '1234' }] },
    })
    expect(bad2.statusCode).toBe(400)
    await app.close()
  })

  it('reveal of a typed card returns structured secretFields', async () => {
    verifiedProfile()
    db.auditLog.count.mockResolvedValue(0) // the throttle test above left 10 in the shared mock
    const secretFields = [
      { kind: 'password', value: 'sup3r' },
      { kind: 'api_key', value: 'key_9' },
    ]
    const enc = encryptSecret(JSON.stringify(secretFields), getKek()!)
    db.credentialVault.findFirst.mockResolvedValue({
      id: CRED,
      revokedAt: null,
      resourceType: 'server',
      ...enc,
    })
    const { app, token } = await authed(CLIENT_OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `/portal/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant: GRANT() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.secretFields).toEqual(secretFields)
    expect(res.json().data.secret).toBeUndefined()
    await app.close()
  })
})
