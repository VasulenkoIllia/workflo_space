import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@workflo/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Cross-tenant isolation against REAL Postgres + RLS (audit P1 — the single most
 * important test class for a multi-tenant SaaS). Connects as the restricted
 * `workflo_app` role (the RLS subject) and asserts that, with one tenant's GUC
 * set, the other tenant's rows are invisible (USING) and unwritable (WITH CHECK)
 * across column-scoped and parent-scoped tables — i.e. the F4 backstop actually
 * bites, independent of the app-layer where-clauses.
 *
 * Gated on RUN_DB_TESTS=1 + DATABASE_URL (a migrated throwaway PG). Skipped in the
 * default mocked unit run; CI runs it against an ephemeral Postgres (hard gate
 * before onboarding any external tenant). See docs/ENGINEERING_STANDARDS.md
 * → "RLS rollout".
 */
const OWNER_URL = process.env.DATABASE_URL
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!OWNER_URL
const run = ENABLED ? describe : describe.skip

const APP_PASSWORD = 'wf_test_app_pw'

/** Derive a workflo_app DSN from the owner URL (same host/db, single connection). */
function appUrlFrom(ownerUrl: string): string {
  const u = new URL(ownerUrl)
  u.username = 'workflo_app'
  u.password = APP_PASSWORD
  u.searchParams.set('connection_limit', '1') // pin one connection so SET sticks
  u.searchParams.set('pool_timeout', '10')
  return u.toString()
}

run('cross-tenant isolation (RLS / workflo_app)', () => {
  // Constructed in beforeAll, not at collection time — a skipped suite still
  // evaluates this callback, and `new PrismaClient({ url: undefined })` would throw.
  let owner: PrismaClient
  let app: PrismaClient

  const A = randomUUID()
  const B = randomUUID()
  const tag = randomUUID().slice(0, 8)
  const creatorId = randomUUID()
  let orderA = ''
  let orderB = ''
  let commentB = ''
  let stageB = ''

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL as string } } })
    // Construct the app client first (Prisma connects lazily) so afterAll can always
    // disconnect even if role setup races a sibling integration file.
    app = new PrismaClient({ datasources: { db: { url: appUrlFrom(OWNER_URL as string) } } })
    // Activate the RLS subject role (migration creates it NOLOGIN). Sibling files
    // (legalEntity, project) ALTER the same role concurrently → tolerate
    // "tuple concurrently updated" with a short retry (same password each time).
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

    // Seed two isolated tenants as owner (GUC unset → permissive even under FORCE RLS).
    await owner.profile.create({
      data: {
        id: creatorId,
        email: `iso-${tag}@test.local`,
        passwordHash: 'x',
        name: 'Iso Creator',
      },
    })
    for (const [id, slug] of [
      [A, `iso-a-${tag}`],
      [B, `iso-b-${tag}`],
    ] as const) {
      await owner.agency.create({ data: { id, name: slug, slug } })
    }
    orderA = (
      await owner.order.create({
        data: { agencyId: A, title: 'A order', createdById: creatorId },
        select: { id: true },
      })
    ).id
    orderB = (
      await owner.order.create({
        data: { agencyId: B, title: 'B order', createdById: creatorId },
        select: { id: true },
      })
    ).id
    commentB = (
      await owner.orderComment.create({
        data: { agencyId: B, orderId: orderB, authorId: creatorId, content: 'B secret' },
        select: { id: true },
      })
    ).id
    stageB = (
      await owner.orderStage.create({
        data: { orderId: orderB, title: 'B stage', position: 1 },
        select: { id: true },
      })
    ).id
  })

  afterAll(async () => {
    // Best-effort cleanup (owner bypasses RLS).
    if (owner) {
      await owner.orderStage.deleteMany({ where: { orderId: { in: [orderA, orderB] } } })
      await owner.orderComment.deleteMany({ where: { agencyId: { in: [A, B] } } })
      await owner.order.deleteMany({ where: { agencyId: { in: [A, B] } } })
      await owner.agency.deleteMany({ where: { id: { in: [A, B] } } })
      await owner.profile.deleteMany({ where: { id: creatorId } })
    }
    if (app) await app.$disconnect()
    if (owner) await owner.$disconnect()
  })

  /** Run fn with the workflo_app session scoped to `agencyId` (session-level SET on the pinned connection). */
  async function asTenant<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
    await app.$executeRawUnsafe(`SELECT set_config('app.current_agency_id', '${agencyId}', false)`)
    return fn()
  }

  it('column-scoped: a tenant lists only its own orders', async () => {
    const aRows = await asTenant(A, () =>
      app.order.findMany({ where: { id: { in: [orderA, orderB] } }, select: { id: true } })
    )
    expect(aRows.map((r) => r.id)).toEqual([orderA])
  })

  it('column-scoped: cannot read the other tenant order by id (RLS → null)', async () => {
    const row = await asTenant(A, () => app.order.findUnique({ where: { id: orderB } }))
    expect(row).toBeNull()
  })

  it('column-scoped: cannot read the other tenant comment by id', async () => {
    const row = await asTenant(A, () => app.orderComment.findUnique({ where: { id: commentB } }))
    expect(row).toBeNull()
  })

  it('parent-scoped (order_stages → orders.agencyId): other tenant stage invisible', async () => {
    const rows = await asTenant(A, () =>
      app.orderStage.findMany({ where: { id: stageB }, select: { id: true } })
    )
    expect(rows).toHaveLength(0)
  })

  it('WITH CHECK: cannot update the other tenant order (invisible row → 0 affected/throws)', async () => {
    // RLS USING hides the row, so update-by-id affects nothing (P2025) rather than
    // mutating another tenant. Either way the row must stay unchanged.
    await asTenant(A, async () => {
      await app.order
        .update({ where: { id: orderB }, data: { title: 'HACKED' } })
        .catch(() => undefined)
    })
    const after = await owner.order.findUnique({ where: { id: orderB }, select: { title: true } })
    expect(after?.title).toBe('B order')
  })

  it('WITH CHECK: cannot INSERT a row stamped with another tenant', async () => {
    await expect(
      asTenant(A, () =>
        app.order.create({ data: { agencyId: B, title: 'cross', createdById: creatorId } })
      )
    ).rejects.toThrow()
  })

  it('each tenant sees its own row when scoped to itself', async () => {
    const a = await asTenant(A, () => app.order.findUnique({ where: { id: orderA } }))
    const b = await asTenant(B, () => app.order.findUnique({ where: { id: orderB } }))
    expect(a?.id).toBe(orderA)
    expect(b?.id).toBe(orderB)
  })
})
