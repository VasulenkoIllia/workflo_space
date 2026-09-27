import { describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// PERM-2: регресійна матриця — фінанси/юр-дані за замовчуванням лише власнику. Виконавець і
// менеджер отримують 403 ДО звернення до БД (Prisma-мок порожній: будь-який запит упав би 500).
vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  const prisma = {}
  return {
    prisma,
    Prisma: actual.Prisma,
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
    tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
  }
})
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
vi.mock('../src/services/audit.js', () => ({ writeAuditAsync: vi.fn() }))

const { buildApp } = await import('../src/app.js')

const base = {
  email: 'x@e.com',
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  memberships: [],
}
const EXECUTOR = {
  ...base,
  sub: 'exec-1',
  role: 'executor',
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' }],
}
const MANAGER = {
  ...base,
  sub: 'mgr-1',
  role: 'executor',
  agencyMemberships: [{ agencyId: 'agency-1', role: 'manager' }],
}

const WINDOW = 'from=2026-09-01&to=2026-09-30'
// [method, url, body?, хто отримує 403]
const MATRIX: [string, string, unknown, ('executor' | 'manager')[]][] = [
  ['GET', '/workspace/billing/overview', undefined, ['executor', 'manager']],
  ['GET', '/workspace/billing/charges', undefined, ['executor', 'manager']],
  ['GET', '/workspace/billing/payments', undefined, ['executor', 'manager']],
  ['GET', '/admin/wallet/companies', undefined, ['executor', 'manager']],
  ['GET', '/workspace/expenses', undefined, ['executor', 'manager']],
  ['GET', `/workspace/reports/pnl?${WINDOW}`, undefined, ['executor', 'manager']],
  ['GET', `/workspace/reports/revenue?${WINDOW}`, undefined, ['executor', 'manager']],
  ['GET', '/workspace/reports/audit', undefined, ['executor', 'manager']],
  ['GET', '/admin/referral/settings', undefined, ['executor', 'manager']],
  ['GET', '/workspace/settings/payment', undefined, ['executor', 'manager']],
  ['GET', '/workspace/legal-entities', undefined, ['executor']],
  ['GET', '/workspace/projects', undefined, ['executor']],
  ['GET', '/workspace/companies', undefined, ['executor']],
  ['GET', '/workspace/nomenclature', undefined, ['executor']],
  ['POST', '/workspace/billing/charges/generate', { month: '2026-09' }, ['executor', 'manager']],
  ['POST', '/workspace/services', { name: 'Послуга' }, ['executor', 'manager']],
  ['POST', '/workspace/team/invite', { email: 'n@e.com' }, ['executor']],
  // CORE-FLOWS (D4): завести компанію-клієнта — clients.manage (менеджер може)
  ['POST', '/workspace/companies', { name: 'ТОВ Нова' }, ['executor']],
]

describe('PERM-2 регресійна матриця фінансових гейтів', () => {
  it.each(MATRIX)('%s %s → 403 для %j', async (method, url, payload, denied) => {
    const app = buildApp()
    await app.ready()
    for (const [who, claims] of [
      ['executor', EXECUTOR],
      ['manager', MANAGER],
    ] as const) {
      if (!denied.includes(who)) continue
      const res = await app.inject({
        method: method as 'GET' | 'POST',
        url,
        headers: { authorization: `Bearer ${app.jwt.sign(claims as never)}` },
        ...(payload ? { payload: payload as object } : {}),
      })
      expect(res.statusCode, `${who} ${method} ${url}`).toBe(403)
    }
    await app.close()
  })
})
