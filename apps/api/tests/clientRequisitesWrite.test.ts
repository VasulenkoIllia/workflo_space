import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PATCH /workspace/clients/:id/requisites — agency edits a client's legal requisites (28-Б).
const db = {
  company: { findUnique: vi.fn(), update: vi.fn() },
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

const { buildApp } = await import('../src/app.js')

const AGENCY = 'agency-1'
const OTHER_AGENCY = 'agency-2'
const COMPANY = 'company-1'

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
  activeCompanyId: COMPANY,
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' }>,
  memberships: [{ companyId: COMPANY, role: 'owner' as const }],
}
const MANAGER = {
  sub: 'manager-1',
  email: 'm@e.com',
  role: 'executor' as const,
  activeAgencyId: AGENCY,
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: AGENCY, role: 'manager' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' }>,
}

async function authed(claims: unknown) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims as object) }
}

const url = `/workspace/clients/${COMPANY}/requisites`
const patch = (
  app: Awaited<ReturnType<typeof authed>>['app'],
  token: string | null,
  body: unknown
) =>
  app.inject({
    method: 'PATCH',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body as object,
  })

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('PATCH /workspace/clients/:id/requisites (agency on behalf)', () => {
  it('an owner edits the client requisites; gate recomputed + audited onBehalf', async () => {
    db.company.findUnique.mockResolvedValue({
      id: COMPANY,
      agencyId: AGENCY,
      legalName: null,
      taxId: null,
      iban: null,
      signerName: null,
    })
    db.company.update.mockResolvedValue({
      id: COMPANY,
      legalName: 'ТОВ Клієнт',
      legalIsComplete: false,
    })
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, { legalName: 'ТОВ Клієнт', legalAddress: 'Київ' })
    expect(res.statusCode).toBe(200)
    expect(db.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: COMPANY } })
    )
    expect(writeAuditAsync).toHaveBeenCalledTimes(1)
    expect(writeAuditAsync.mock.calls[0]![1]).toMatchObject({
      action: 'company.requisites_updated',
      metadata: expect.objectContaining({ onBehalf: true }),
    })
    await app.close()
  })

  it('is 404 for a company in another tenant (applyClientRequisites agency check)', async () => {
    db.company.findUnique.mockResolvedValue({
      id: COMPANY,
      agencyId: OTHER_AGENCY,
      legalName: null,
      taxId: null,
      iban: null,
      signerName: null,
    })
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, { legalName: 'ТОВ Інша' })
    expect(res.statusCode).toBe(404)
    expect(db.company.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('a client cannot edit via the workspace route (403)', async () => {
    const { app, token } = await authed(CLIENT)
    const res = await patch(app, token, { legalName: 'ТОВ Клієнт' })
    expect(res.statusCode).toBe(403)
    expect(db.company.findUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('a manager is blocked (403)', async () => {
    const { app, token } = await authed(MANAGER)
    const res = await patch(app, token, { legalName: 'ТОВ Клієнт' })
    expect(res.statusCode).toBe(403)
    expect(db.company.findUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects an empty body (400, at least one field required)', async () => {
    const { app, token } = await authed(OWNER)
    const res = await patch(app, token, {})
    expect(res.statusCode).toBe(400)
    expect(db.company.findUnique).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 401 without a token', async () => {
    const { app } = await authed(OWNER)
    const res = await patch(app, null, { legalName: 'ТОВ Клієнт' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
