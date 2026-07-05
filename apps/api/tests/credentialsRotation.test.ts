import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// 17-РОТАЦІЯ: daily sweep — remind agency owners about expiring secrets (in-app only).
const db = {
  credentialVault: { findMany: vi.fn(), update: vi.fn() },
  agencyMember: { findMany: vi.fn() },
}

vi.mock('@workflo/db', () => ({
  prisma: db,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTenant: (fn: (tx: unknown) => unknown) => fn(db),
  tenantTransaction: (_p: unknown, fn: (tx: unknown) => unknown) => fn(db),
  runWithSystemContext: (fn: () => unknown) => fn(),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))
const dispatchNotification = vi.fn()
vi.mock('../src/services/notifications.js', () => ({ dispatchNotification }))

const { runCredentialsRotationOnce } = await import('../src/cron/credentialsRotation.js')

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as never

const NOW = new Date('2026-07-05T12:00:00Z')

beforeEach(() => vi.clearAllMocks())

describe('runCredentialsRotationOnce (17-РОТАЦІЯ)', () => {
  it('reminds every agency owner about a due secret and stamps rotationRemindedAt', async () => {
    db.credentialVault.findMany.mockResolvedValue([
      {
        id: 'cred-1',
        agencyId: 'agency-1',
        companyId: 'company-1',
        label: 'FTP',
        expiresAt: new Date('2026-07-08T00:00:00Z'), // за 3 дні → due
        company: { name: 'ТОВ' },
      },
    ])
    db.agencyMember.findMany.mockResolvedValue([
      { agencyId: 'agency-1', profileId: 'owner-1' },
      { agencyId: 'agency-1', profileId: 'owner-2' },
    ])
    const n = await runCredentialsRotationOnce(logger, NOW)
    expect(n).toBe(1)
    // both owners notified, secret stamped once
    expect(dispatchNotification).toHaveBeenCalledTimes(2)
    const call = dispatchNotification.mock.calls[0]![1] as {
      event: string
      inApp: { title: string }
    }
    expect(call.event).toBe('credentials.rotation_due')
    expect(call.inApp.title).toContain('потребує ротації')
    expect(db.credentialVault.update).toHaveBeenCalledWith({
      where: { id: 'cred-1' },
      data: { rotationRemindedAt: NOW },
    })
  })

  it('an overdue secret gets the «протерміновано» wording', async () => {
    db.credentialVault.findMany.mockResolvedValue([
      {
        id: 'cred-2',
        agencyId: 'agency-1',
        companyId: 'company-1',
        label: 'API key',
        expiresAt: new Date('2026-07-01T00:00:00Z'), // минув
        company: { name: 'ТОВ' },
      },
    ])
    db.agencyMember.findMany.mockResolvedValue([{ agencyId: 'agency-1', profileId: 'owner-1' }])
    await runCredentialsRotationOnce(logger, NOW)
    const call = dispatchNotification.mock.calls[0]![1] as { inApp: { title: string } }
    expect(call.inApp.title).toContain('протерміновано')
  })

  it('nothing due → 0, no notifications, no writes', async () => {
    db.credentialVault.findMany.mockResolvedValue([])
    const n = await runCredentialsRotationOnce(logger, NOW)
    expect(n).toBe(0)
    expect(dispatchNotification).not.toHaveBeenCalled()
    expect(db.credentialVault.update).not.toHaveBeenCalled()
  })

  it('the due-query filters revoked and recently-reminded secrets', async () => {
    db.credentialVault.findMany.mockResolvedValue([])
    await runCredentialsRotationOnce(logger, NOW)
    const arg = db.credentialVault.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
    }
    expect(arg.where.revokedAt).toBeNull()
    expect(arg.where).toHaveProperty('OR')
  })
})
