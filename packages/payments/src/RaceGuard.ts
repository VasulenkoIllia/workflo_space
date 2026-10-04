/**
 * Single-flight mutual exclusion by key. Concurrent calls with the SAME key
 * share ONE execution of `fn`; distinct keys run independently.
 *
 * The contract lives here (DB-agnostic) so apps/api can provide a durable,
 * cross-process implementation backed by `SELECT … FOR UPDATE` / the
 * IdempotencyKey table. This package only defines the interface + an in-memory
 * double for unit tests and single-process callers — it MUST NOT import Prisma.
 */
export interface RaceGuard {
  runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T>
}

/**
 * In-process {@link RaceGuard}. Collapses concurrent same-key calls onto the
 * first in-flight promise (so `fn` runs once and all callers get its result),
 * and releases the key once it settles — a failure is NOT cached, so the next
 * call re-runs `fn`. Not durable across processes; for that use the apps/api
 * DB-backed guard.
 */
export class InMemoryRaceGuard implements RaceGuard {
  private readonly inflight = new Map<string, Promise<unknown>>()

  runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) return existing as Promise<T>

    // Wrap in an async IIFE so a synchronous throw in `fn` becomes a rejection,
    // and `finally` always releases the key (success OR failure → next call re-runs).
    const run = (async () => fn())().finally(() => {
      this.inflight.delete(key)
    })
    this.inflight.set(key, run)
    return run
  }
}
