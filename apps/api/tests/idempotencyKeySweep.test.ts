import { describe, expect, it, vi } from 'vitest'

const deleteMany = vi.fn()
vi.mock('@workflo/db', () => ({ prisma: { idempotencyKey: { deleteMany } } }))

const { sweepIdempotencyKeys } = await import('../src/cron/idempotencyKeySweep.js')

const logger = { info: vi.fn(), error: vi.fn() } as unknown as Parameters<
  typeof sweepIdempotencyKeys
>[0]

describe('sweepIdempotencyKeys', () => {
  it('deletes only keys whose expiresAt is before now', async () => {
    deleteMany.mockResolvedValue({ count: 3 })
    const now = new Date('2026-06-25T00:00:00Z')
    const res = await sweepIdempotencyKeys(logger, now)
    expect(res.deleted).toBe(3)
    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } })
  })

  it('stays quiet (no log) when nothing is expired', async () => {
    vi.clearAllMocks()
    deleteMany.mockResolvedValue({ count: 0 })
    const res = await sweepIdempotencyKeys(logger, new Date())
    expect(res.deleted).toBe(0)
    expect(logger.info).not.toHaveBeenCalled()
  })
})
