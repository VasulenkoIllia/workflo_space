import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.CREDENTIALS_KEK_BASE64 = Buffer.alloc(32, 7).toString('base64')

// Credentials Vault (module 17), agency-side. Real crypto (KEK above) — reveal actually decrypts.
const db = {
  company: { findFirst: vi.fn() },
  credentialVault: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: { findMany: vi.fn() },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')
const { encryptSecret, getKek } = await import('../src/services/credentialCrypto.js')

const AGENCY = 'agency-1'
const COMPANY = 'company-1'
const CRED = 'cred-1'

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

const base = `/workspace/clients/${COMPANY}/credentials`
const metaRow = {
  id: CRED,
  label: 'Bitrix24 admin',
  service: 'bitrix24',
  url: 'https://b24',
  username: 'admin',
  notes: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdById: OWNER.sub,
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('GET /workspace/clients/:id/credentials — list', () => {
  it('owner lists metadata, no ciphertext/secret leaks', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.findMany.mockResolvedValue([metaRow])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: base,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const c = res.json().data.credentials[0]
    expect(c).toMatchObject({ id: CRED, label: 'Bitrix24 admin', revoked: false })
    expect(JSON.stringify(res.json())).not.toMatch(/ciphertext|encryptedDek|secret/)
    await app.close()
  })

  it('executor is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: base,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.company.findFirst).not.toHaveBeenCalled()
    await app.close()
  })

  it('cross-tenant company → 404', async () => {
    db.company.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: base,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('GET /workspace/vault — global (17-ГЛОБАЛ)', () => {
  it('owner lists secrets across clients with company name, no plaintext', async () => {
    db.credentialVault.findMany.mockResolvedValue([
      { ...metaRow, companyId: COMPANY, company: { name: 'Acme' } },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/vault',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const c = res.json().data.credentials[0]
    expect(c).toMatchObject({ id: CRED, companyId: COMPANY, companyName: 'Acme' })
    expect(JSON.stringify(res.json())).not.toMatch(/ciphertext|encryptedDek|secret/)
    await app.close()
  })

  it('executor is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/vault',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(db.credentialVault.findMany).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('POST /workspace/clients/:id/credentials — create', () => {
  it('encrypts the secret before storing (no plaintext persisted)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.create.mockResolvedValue(metaRow)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: base,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Bitrix24 admin', service: 'bitrix24', secret: 'hunter2' },
    })
    expect(res.statusCode).toBe(201)
    const data = db.credentialVault.create.mock.calls[0][0].data
    expect(Buffer.isBuffer(data.ciphertext)).toBe(true)
    expect(data.secret).toBeUndefined()
    // the stored ciphertext must not contain the plaintext
    expect(data.ciphertext.toString('utf8')).not.toContain('hunter2')
    expect(res.json().data.credential.label).toBe('Bitrix24 admin')
    await app.close()
  })

  it('rejects an empty label (400)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: base,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: '', secret: 'x' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('503 when the vault KEK is not configured', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    const saved = process.env.CREDENTIALS_KEK_BASE64
    delete process.env.CREDENTIALS_KEK_BASE64
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: base,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'x', secret: 'y' },
    })
    expect(res.statusCode).toBe(503)
    process.env.CREDENTIALS_KEK_BASE64 = saved
    await app.close()
  })
})

describe('POST …/:credId/reveal — decrypt one secret', () => {
  function encRow(secret: string, revokedAt: Date | null = null) {
    const kek = getKek()!
    return { id: CRED, revokedAt, ...encryptSecret(secret, kek) }
  }

  it('returns the decrypted secret + Cache-Control no-store', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.findFirst.mockResolvedValue(encRow('s3cr3t-пароль'))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `${base}/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.secret).toBe('s3cr3t-пароль')
    expect(res.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  it('refuses to reveal a revoked secret (409)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.findFirst.mockResolvedValue(encRow('x', new Date('2026-01-02T00:00:00Z')))
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `${base}/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('missing secret → 404', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `${base}/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('GET …/:credId/audit — access journal (17-Б)', () => {
  it('owner sees reveal/change history with actor + ip', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        action: 'credentials.revealed',
        result: 'allowed',
        createdAt: new Date('2026-02-01T10:00:00Z'),
        actorId: OWNER.sub,
        actor: { name: 'Ілля' },
        metadata: { ip: '1.2.3.4', companyId: COMPANY },
      },
    ])
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'GET',
      url: `${base}/${CRED}/audit`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.entries[0]).toMatchObject({
      action: 'credentials.revealed',
      actorName: 'Ілля',
      ip: '1.2.3.4',
    })
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { resourceType: 'credential', resourceId: CRED },
      })
    )
    await app.close()
  })

  it('executor is forbidden (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `${base}/${CRED}/audit`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('revoke + delete', () => {
  it('revoke sets revokedAt (200)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.updateMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `${base}/${CRED}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ revoked: CRED })
    await app.close()
  })

  it('revoke of an already-revoked/missing secret → 404', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.updateMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: `${base}/${CRED}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('delete removes the row (200)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.deleteMany.mockResolvedValue({ count: 1 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `${base}/${CRED}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ deleted: CRED })
    await app.close()
  })

  it('delete of a missing secret → 404', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialVault.deleteMany.mockResolvedValue({ count: 0 })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: `${base}/${CRED}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
