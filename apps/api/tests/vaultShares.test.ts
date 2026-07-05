import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.CREDENTIALS_KEK_BASE64 = Buffer.alloc(32, 7).toString('base64')

// 17-SHARE: executor access grants (owner-managed) + share-scoped executor reads.
const db = {
  credentialVault: { findMany: vi.fn(), findFirst: vi.fn() },
  credentialShare: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  agencyMember: { findFirst: vi.fn() },
  company: { findFirst: vi.fn() },
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
vi.mock('../src/auth/password.js', () => ({ verifyPassword: vi.fn().mockResolvedValue(true) }))

const { buildApp } = await import('../src/app.js')
const { encryptSecret, getKek } = await import('../src/services/credentialCrypto.js')
const { issueRevealGrant } = await import('../src/services/vaultGrant.js')

const AGENCY = 'agency-1'
const COMPANY = 'company-1'
const CRED = 'cred-1'
const EXEC_ID = 'exec-1'

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
  sub: EXEC_ID,
  role: 'executor' as const,
  agencyMemberships: [{ agencyId: AGENCY, role: 'executor' as const }],
}
const MANAGER = {
  ...OWNER,
  sub: 'mgr-1',
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const shareRow = (over: Record<string, unknown> = {}) => ({
  id: 'share-1',
  credentialId: null,
  companyId: COMPANY,
  executorId: EXEC_ID,
  grantedById: OWNER.sub,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  ...over,
})

const metaRow = {
  id: CRED,
  label: 'FTP',
  service: 'ftp',
  url: null,
  username: null,
  resourceType: null,
  publicFields: null,
  notes: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdById: OWNER.sub,
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('POST /workspace/vault/shares — grant', () => {
  it('owner grants a company-level share to an executor (201, audited)', async () => {
    db.agencyMember.findFirst.mockResolvedValue({ id: 'am-1' })
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialShare.findFirst.mockResolvedValue(null)
    db.credentialShare.create.mockResolvedValue(shareRow())
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: EXEC_ID, companyId: COMPANY },
    })
    expect(res.statusCode).toBe(201)
    const audit = writeAuditAsync.mock.calls[0]![1] as { action: string }
    expect(audit.action).toBe('credentials.share_granted')
    await app.close()
  })

  it('grant target must be an executor of the agency (400)', async () => {
    db.agencyMember.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: 'stranger-1', companyId: COMPANY },
    })
    expect(res.statusCode).toBe(400)
    expect(db.credentialShare.create).not.toHaveBeenCalled()
    await app.close()
  })

  it('both / neither targets → 400 (XOR)', async () => {
    const { app, token } = await authed(OWNER)
    const both = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: EXEC_ID, companyId: COMPANY, credentialId: CRED },
    })
    expect(both.statusCode).toBe(400)
    const neither = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: EXEC_ID },
    })
    expect(neither.statusCode).toBe(400)
    await app.close()
  })

  it('duplicate active grant → 409', async () => {
    db.agencyMember.findFirst.mockResolvedValue({ id: 'am-1' })
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialShare.findFirst.mockResolvedValue({ id: 'share-1' })
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: EXEC_ID, companyId: COMPANY },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('executor/manager cannot grant (403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: EXEC_ID, companyId: COMPANY },
    })
    expect(res.statusCode).toBe(403)
    const { app: app2, token: token2 } = await authed(MANAGER)
    const res2 = await app2.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token2}` },
      payload: { executorId: EXEC_ID, companyId: COMPANY },
    })
    expect(res2.statusCode).toBe(403)
    await app.close()
    await app2.close()
  })

  it('cross-tenant credential target → 404', async () => {
    db.agencyMember.findFirst.mockResolvedValue({ id: 'am-1' })
    db.credentialVault.findFirst.mockResolvedValue(null)
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
      payload: { executorId: EXEC_ID, credentialId: 'cred-foreign' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

describe('DELETE /workspace/vault/shares/:id — revoke', () => {
  it('owner revokes; repeat → 404', async () => {
    db.credentialShare.findFirst.mockResolvedValueOnce(shareRow()).mockResolvedValueOnce(null)
    db.credentialShare.update.mockResolvedValue({})
    const { app, token } = await authed(OWNER)
    const res = await app.inject({
      method: 'DELETE',
      url: '/workspace/vault/shares/share-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const again = await app.inject({
      method: 'DELETE',
      url: '/workspace/vault/shares/share-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(again.statusCode).toBe(404)
    await app.close()
  })
})

describe('executor share-scoped reads', () => {
  it('company-level share opens the FULL client list', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialShare.findMany.mockResolvedValue([
      { companyId: COMPANY, credentialId: null, credential: null },
    ])
    db.credentialVault.findMany.mockResolvedValue([metaRow])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/credentials`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.credentials).toHaveLength(1)
    // no id-subset filter — the whole company is open
    const arg = db.credentialVault.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(arg.where).toEqual({ companyId: COMPANY })
    await app.close()
  })

  it('point share limits the list to the shared ids', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialShare.findMany.mockResolvedValue([
      { companyId: null, credentialId: CRED, credential: { companyId: COMPANY } },
    ])
    db.credentialVault.findMany.mockResolvedValue([metaRow])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/credentials`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const arg = db.credentialVault.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(arg.where).toEqual({ companyId: COMPANY, id: { in: [CRED] } })
    await app.close()
  })

  it('executor reveals a SHARED secret (200) but not an unshared one (403)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialShare.findMany.mockResolvedValue([
      { companyId: null, credentialId: CRED, credential: { companyId: COMPANY } },
    ])
    const enc = encryptSecret('shared-secret', getKek()!)
    db.credentialVault.findFirst.mockResolvedValue({
      id: CRED,
      revokedAt: null,
      resourceType: null,
      ...enc,
    })
    const grant = issueRevealGrant(EXEC_ID).grant
    const { app, token } = await authed(EXECUTOR)
    const ok = await app.inject({
      method: 'POST',
      url: `/workspace/clients/${COMPANY}/credentials/${CRED}/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data.secret).toBe('shared-secret')

    const denied = await app.inject({
      method: 'POST',
      url: `/workspace/clients/${COMPANY}/credentials/cred-other/reveal`,
      headers: { authorization: `Bearer ${token}` },
      payload: { grant },
    })
    expect(denied.statusCode).toBe(403)
    await app.close()
  })

  it('revoked share = no access (list falls back to empty)', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    db.credentialShare.findMany.mockResolvedValue([]) // where{revokedAt:null} filters it out
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/credentials`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.credentials).toEqual([])
    await app.close()
  })

  it('manager stays hard-blocked (403) on list', async () => {
    db.company.findFirst.mockResolvedValue({ id: COMPANY })
    const { app, token } = await authed(MANAGER)
    const res = await app.inject({
      method: 'GET',
      url: `/workspace/clients/${COMPANY}/credentials`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('global /vault for an executor = union of shares only', async () => {
    db.credentialShare.findMany.mockResolvedValue([
      { companyId: COMPANY, credentialId: null },
      { companyId: null, credentialId: 'cred-9' },
    ])
    db.credentialVault.findMany.mockResolvedValue([
      { ...metaRow, companyId: COMPANY, company: { name: 'ТОВ' } },
    ])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/vault',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const arg = db.credentialVault.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(arg.where).toMatchObject({
      agencyId: AGENCY,
      OR: [{ companyId: { in: [COMPANY] } }, { id: { in: ['cred-9'] } }],
    })
    await app.close()
  })

  it('GET shares list is owner-only (executor 403)', async () => {
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/vault/shares',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
