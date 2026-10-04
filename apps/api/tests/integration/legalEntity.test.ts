import { randomUUID } from 'node:crypto'
import { PrismaClient, provisionAgency } from '@workflo/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Agency legal entities (20-Д, P-1б) against REAL Postgres + RLS. Covers the two
 * durable invariants worth locking before any UI hardening (MODULE_HARDENING):
 *   1. provisionAgency seeds exactly one default, incomplete entity (Юр-1/Юр-2).
 *   2. legal_entities is tenant-isolated under the workflo_app role (RLS): another
 *      tenant's entity is invisible (USING) and unwritable (WITH CHECK).
 *
 * Gated on RUN_DB_TESTS=1 + DATABASE_URL (migrated throwaway PG); skipped in the
 * mocked unit run. CI runs it against ephemeral Postgres (db-gate).
 */
const OWNER_URL = process.env.DATABASE_URL
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!OWNER_URL
const run = ENABLED ? describe : describe.skip

const APP_PASSWORD = 'wf_test_app_pw'

function appUrlFrom(ownerUrl: string): string {
  const u = new URL(ownerUrl)
  u.username = 'workflo_app'
  u.password = APP_PASSWORD
  u.searchParams.set('connection_limit', '1')
  u.searchParams.set('pool_timeout', '10')
  return u.toString()
}

run('legal entities — provisioning + RLS isolation', () => {
  let owner: PrismaClient
  let app: PrismaClient

  const tag = randomUUID().slice(0, 8)
  const ownerA = randomUUID()
  const ownerB = randomUUID()
  let agencyA = ''
  let agencyB = ''
  let entityB = ''

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL as string } } })
    // Construct the app client first (Prisma connects lazily) so afterAll can always
    // disconnect even if role setup races a sibling test file.
    app = new PrismaClient({ datasources: { db: { url: appUrlFrom(OWNER_URL as string) } } })
    // Idempotent role login/password. Another integration file (tenantIsolation)
    // ALTERs the same role concurrently → tolerate "tuple concurrently updated".
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await owner.$executeRawUnsafe(
          `ALTER ROLE workflo_app WITH LOGIN PASSWORD '${APP_PASSWORD}'`
        )
        break
      } catch (err) {
        if (attempt === 2) throw err
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    for (const [pid, slug] of [
      [ownerA, `le-a-${tag}`],
      [ownerB, `le-b-${tag}`],
    ] as const) {
      await owner.profile.create({
        data: { id: pid, email: `${slug}@test.local`, passwordHash: 'x', name: slug },
      })
    }
    // provisionAgency is the unit under test for invariant #1 — it must seed the
    // default legal entity as part of tenant bootstrap.
    agencyA = (
      await provisionAgency(owner, {
        name: `LE A ${tag}`,
        slug: `le-a-${tag}`,
        ownerProfileId: ownerA,
      })
    ).agencyId
    agencyB = (
      await provisionAgency(owner, {
        name: `LE B ${tag}`,
        slug: `le-b-${tag}`,
        ownerProfileId: ownerB,
      })
    ).agencyId
    entityB = (
      await owner.legalEntity.findFirstOrThrow({
        where: { agencyId: agencyB },
        select: { id: true },
      })
    ).id
  })

  afterAll(async () => {
    if (owner) {
      await owner.legalEntity.deleteMany({ where: { agencyId: { in: [agencyA, agencyB] } } })
      await owner.agencyMember.deleteMany({ where: { agencyId: { in: [agencyA, agencyB] } } })
      await owner.agency.deleteMany({ where: { id: { in: [agencyA, agencyB] } } })
      await owner.profile.deleteMany({ where: { id: { in: [ownerA, ownerB] } } })
    }
    if (app) await app.$disconnect()
    if (owner) await owner.$disconnect()
  })

  async function asTenant<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
    await app.$executeRawUnsafe(`SELECT set_config('app.current_agency_id', '${agencyId}', false)`)
    return fn()
  }

  it('provisionAgency seeds exactly one default, incomplete legal entity (Юр-1/Юр-2)', async () => {
    const rows = await owner.legalEntity.findMany({ where: { agencyId: agencyA } })
    expect(rows).toHaveLength(1)
    expect(rows[0].isDefault).toBe(true)
    expect(rows[0].isComplete).toBe(false) // taxId/iban/signerName unset
    expect(rows[0].legalType).toBe('fop')
  })

  it('provisionAgency is idempotent — a second call adds no extra entity', async () => {
    await provisionAgency(owner, {
      name: `LE A ${tag}`,
      slug: `le-a-${tag}`,
      ownerProfileId: ownerA,
    })
    const count = await owner.legalEntity.count({ where: { agencyId: agencyA } })
    expect(count).toBe(1)
  })

  it('RLS: a tenant lists only its own legal entities', async () => {
    const rows = await asTenant(agencyA, () =>
      app.legalEntity.findMany({
        where: { agencyId: { in: [agencyA, agencyB] } },
        select: { agencyId: true },
      })
    )
    expect(rows.every((r) => r.agencyId === agencyA)).toBe(true)
    expect(rows.length).toBe(1)
  })

  it('RLS: cannot read the other tenant entity by id (USING → null)', async () => {
    const row = await asTenant(agencyA, () =>
      app.legalEntity.findUnique({ where: { id: entityB } })
    )
    expect(row).toBeNull()
  })

  it('RLS WITH CHECK: cannot update the other tenant entity (invisible → unchanged)', async () => {
    await asTenant(agencyA, async () => {
      await app.legalEntity
        .update({ where: { id: entityB }, data: { legalName: 'HACKED' } })
        .catch(() => undefined)
    })
    const after = await owner.legalEntity.findUnique({
      where: { id: entityB },
      select: { legalName: true },
    })
    expect(after?.legalName).not.toBe('HACKED')
  })

  it('RLS WITH CHECK: cannot INSERT an entity stamped with another tenant', async () => {
    await expect(
      asTenant(agencyA, () =>
        app.legalEntity.create({
          data: { agencyId: agencyB, name: `x-${tag}`, legalType: 'fop', legalName: 'cross' },
        })
      )
    ).rejects.toThrow()
  })
})
