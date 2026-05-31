import type { PrismaClient } from '@workflo/db'
import { describe, expect, it, vi } from 'vitest'
import { backoffMs, enqueueOutbox, processOutboxBatch } from '../src/services/outbox.js'

interface ClaimedRow {
  id: string
  type: string
  payload: unknown
  agencyId: string | null
  attempts: number
  maxAttempts: number
}

function mkPrisma(claimed: ClaimedRow[]) {
  const update = vi.fn().mockResolvedValue({})
  const queryRaw = vi.fn().mockResolvedValue(claimed)
  const prisma = {
    $queryRaw: queryRaw,
    outboxEvent: { update },
  } as unknown as PrismaClient
  return { prisma, update }
}

describe('outbox service', () => {
  it('enqueueOutbox inserts a pending event in the given tx', async () => {
    const create = vi.fn().mockResolvedValue({})
    const tx = { outboxEvent: { create } } as unknown as Pick<PrismaClient, 'outboxEvent'>
    await enqueueOutbox(tx, { type: 'order.created', payload: { orderId: 'o1' }, agencyId: 'a1' })
    expect(create).toHaveBeenCalledWith({
      data: { type: 'order.created', payload: { orderId: 'o1' }, agencyId: 'a1' },
    })
  })

  it('backoffMs grows exponentially and caps at 1h', () => {
    expect(backoffMs(1)).toBe(30_000)
    expect(backoffMs(2)).toBe(60_000)
    expect(backoffMs(3)).toBe(120_000)
    expect(backoffMs(99)).toBe(60 * 60 * 1000) // capped
  })

  it('marks an event done on handler success', async () => {
    const { prisma, update } = mkPrisma([
      { id: 'e1', type: 't', payload: {}, agencyId: null, attempts: 0, maxAttempts: 8 },
    ])
    const res = await processOutboxBatch(prisma, async () => {})
    expect(res).toEqual({ processed: 1, failed: 0, dead: 0 })
    // attempts is bumped atomically by the claim UPDATE, not the post-handler update.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'done' }),
      })
    )
  })

  it('retries with backoff on failure below maxAttempts', async () => {
    // attempts=2 = post-claim count (2 of 8 used) → still below max → retry.
    const { prisma, update } = mkPrisma([
      { id: 'e2', type: 't', payload: {}, agencyId: null, attempts: 2, maxAttempts: 8 },
    ])
    const res = await processOutboxBatch(prisma, async () => {
      throw new Error('boom')
    })
    expect(res).toEqual({ processed: 0, failed: 1, dead: 0 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', lastError: 'boom' }),
      })
    )
  })

  it('moves to the DLQ (dead) once attempts reach maxAttempts', async () => {
    // attempts=8 = post-claim count == maxAttempts → dead-letter.
    const { prisma, update } = mkPrisma([
      { id: 'e3', type: 't', payload: {}, agencyId: null, attempts: 8, maxAttempts: 8 },
    ])
    const res = await processOutboxBatch(prisma, async () => {
      throw new Error('boom')
    })
    expect(res).toEqual({ processed: 0, failed: 0, dead: 1 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'dead' }) })
    )
  })
})
