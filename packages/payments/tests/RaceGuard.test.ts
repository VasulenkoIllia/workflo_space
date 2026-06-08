import { describe, expect, it, vi } from 'vitest'
import { InMemoryRaceGuard } from '../src/index.js'

describe('InMemoryRaceGuard (S5-01)', () => {
  it('runs fn exactly once for concurrent same-key calls and shares the result', async () => {
    const guard = new InMemoryRaceGuard()
    const fn = vi.fn(async () => {
      await Promise.resolve()
      return 'result'
    })

    const [a, b] = await Promise.all([guard.runExclusive('key', fn), guard.runExclusive('key', fn)])

    expect(fn).toHaveBeenCalledTimes(1) // single-flight: collapsed onto one execution
    expect(a).toBe('result')
    expect(b).toBe('result')
  })

  it('runs distinct keys independently', async () => {
    const guard = new InMemoryRaceGuard()
    const fa = vi.fn(async () => 'a')
    const fb = vi.fn(async () => 'b')

    const [a, b] = await Promise.all([guard.runExclusive('a', fa), guard.runExclusive('b', fb)])

    expect(fa).toHaveBeenCalledTimes(1)
    expect(fb).toHaveBeenCalledTimes(1)
    expect(a).toBe('a')
    expect(b).toBe('b')
  })

  it('releases the key after settle so a later same-key call re-runs', async () => {
    const guard = new InMemoryRaceGuard()
    const fn = vi.fn(async () => 'x')

    await guard.runExclusive('key', fn)
    await guard.runExclusive('key', fn) // sequential — first already settled

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('propagates rejection to all concurrent waiters and does NOT cache the failure', async () => {
    const guard = new InMemoryRaceGuard()
    const failing = vi.fn(async () => {
      throw new Error('boom')
    })

    const [r1, r2] = await Promise.allSettled([
      guard.runExclusive('key', failing),
      guard.runExclusive('key', failing),
    ])

    expect(r1.status).toBe('rejected')
    expect(r2.status).toBe('rejected')
    expect(failing).toHaveBeenCalledTimes(1) // shared in-flight promise

    // Failure released the key → next call re-runs and can succeed.
    const ok = vi.fn(async () => 'ok')
    await expect(guard.runExclusive('key', ok)).resolves.toBe('ok')
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('wraps a synchronous throw in fn as a rejection', async () => {
    const guard = new InMemoryRaceGuard()
    await expect(
      guard.runExclusive('key', () => {
        throw new Error('sync-throw')
      })
    ).rejects.toThrow('sync-throw')
  })
})
