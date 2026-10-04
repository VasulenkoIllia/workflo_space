import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const agencyFindUnique = vi.fn()
const agencyUpdate = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    agency: { findUnique: agencyFindUnique, update: agencyUpdate },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const ownerClaims = {
  sub: 'owner-1',
  email: 'owner@x.com',
  role: 'owner',
  activeAgencyId: 'ag-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'ag-1', role: 'owner' }],
  memberships: [],
}
const executorClaims = {
  ...ownerClaims,
  sub: 'exec-1',
  agencyMemberships: [{ agencyId: 'ag-1', role: 'executor' }],
}

async function authed(claims: object) {
  const app = buildApp()
  await app.ready()
  return { app, token: app.jwt.sign(claims) }
}

beforeEach(() => {
  vi.clearAllMocks()
  agencyFindUnique.mockResolvedValue({
    monthlyReportEnabled: false,
    monthlyReportLastSentAt: null,
  })
  agencyUpdate.mockResolvedValue({
    monthlyReportEnabled: true,
    monthlyReportLastSentAt: null,
  })
})
afterEach(() => vi.clearAllMocks())

describe('/workspace/agency/report-settings (S11)', () => {
  it('GET returns the toggle state to the owner', async () => {
    const { app, token } = await authed(ownerClaims)
    const res = await app.inject({
      method: 'GET',
      url: '/workspace/agency/report-settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.monthlyReportEnabled).toBe(false)
    await app.close()
  })

  it('PATCH toggles the monthly report on', async () => {
    const { app, token } = await authed(ownerClaims)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/agency/report-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { monthlyReportEnabled: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.monthlyReportEnabled).toBe(true)
    expect(agencyUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 'ag-1' },
      data: { monthlyReportEnabled: true },
    })
    await app.close()
  })

  it('403s a non-owner', async () => {
    const { app, token } = await authed(executorClaims)
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace/agency/report-settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { monthlyReportEnabled: true },
    })
    expect(res.statusCode).toBe(403)
    expect(agencyUpdate).not.toHaveBeenCalled()
    await app.close()
  })
})
