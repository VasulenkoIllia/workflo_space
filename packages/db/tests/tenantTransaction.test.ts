import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Prisma, PrismaClient } from '@prisma/client'
import { tenantTransaction } from '../src/index.js'
import { runWithAgency, runWithSystemContext } from '../src/tenantContext.js'

/**
 * The single most load-bearing seam for multi-tenancy (F4 / ADR-007, AR-23):
 * tenantTransaction must (a) set the agency GUC under a bound tenant context,
 * (b) set the bypass GUC under a system context, (c) pass through when no context
 * is bound and RLS is not enforced, and (d) FAIL CLOSED (throw) when no context is
 * bound while RLS_ENFORCED=true — a lost AsyncLocalStorage context must never
 * silently degrade into a cross-tenant query.
 */

function fakeClient() {
  const executed: string[] = []
  const tx = {
    $executeRaw: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => {
      executed.push(strings.join('?') + '|' + vals.join(','))
      return Promise.resolve(0)
    }),
  } as unknown as Prisma.TransactionClient
  const client = {
    $transaction: (fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaClient
  return { client, executed }
}

afterEach(() => {
  delete process.env.RLS_ENFORCED
})

describe('tenantTransaction (RLS GUC seam)', () => {
  it('sets app.current_agency_id when an agency context is bound', async () => {
    const { client, executed } = fakeClient()
    const result = await runWithAgency('agency-X', () =>
      tenantTransaction(client, () => Promise.resolve('ok'))
    )
    expect(result).toBe('ok')
    expect(executed).toHaveLength(1)
    expect(executed[0]).toContain('app.current_agency_id')
    expect(executed[0]).toContain('agency-X')
  })

  it('sets app.rls_bypass under a system context (worker/seed)', async () => {
    const { client, executed } = fakeClient()
    await runWithSystemContext(() => tenantTransaction(client, () => Promise.resolve(null)))
    expect(executed).toHaveLength(1)
    expect(executed[0]).toContain('app.rls_bypass')
  })

  it('passes through with NO context while RLS_ENFORCED is off (rollout-transitional)', async () => {
    const { client, executed } = fakeClient()
    const result = await tenantTransaction(client, () => Promise.resolve(42))
    expect(result).toBe(42)
    expect(executed).toHaveLength(0) // no GUC set — permissive policies apply
  })

  it('FAILS CLOSED with no context while RLS_ENFORCED=true (AR-23)', async () => {
    process.env.RLS_ENFORCED = 'true'
    const { client } = fakeClient()
    const fn = vi.fn(() => Promise.resolve('leaked'))
    await expect(tenantTransaction(client, fn)).rejects.toThrow(/no tenant context/)
    expect(fn).not.toHaveBeenCalled() // the query never ran unscoped
  })

  it('still works under RLS_ENFORCED=true when a context IS bound', async () => {
    process.env.RLS_ENFORCED = 'true'
    const { client, executed } = fakeClient()
    await runWithAgency('agency-Y', () => tenantTransaction(client, () => Promise.resolve(1)))
    expect(executed[0]).toContain('agency-Y')
  })
})
