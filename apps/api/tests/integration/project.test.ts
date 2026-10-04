import { randomUUID } from 'node:crypto'
import { PrismaClient, provisionAgency } from '@workflo/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Financial projects (05-ПРОЕКТИ, P-1) against REAL Postgres + RLS. Durable
 * invariants (MODULE_HARDENING): tenant isolation on projects +
 * project_executor_rates, the per-company unique name, and the legalEntity
 * SET NULL cascade.
 *
 * Gated on RUN_DB_TESTS=1 + DATABASE_URL; skipped in the mocked unit run.
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

run('financial projects — RLS + constraints', () => {
  let owner: PrismaClient
  let app: PrismaClient

  const tag = randomUUID().slice(0, 8)
  const ownerA = randomUUID()
  const ownerB = randomUUID()
  const execId = randomUUID()
  let agencyA = ''
  let agencyB = ''
  let companyA = ''
  let companyB = ''
  let projectB = ''

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL as string } } })
    app = new PrismaClient({ datasources: { db: { url: appUrlFrom(OWNER_URL as string) } } })
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
      [ownerA, `pr-a-${tag}`],
      [ownerB, `pr-b-${tag}`],
    ] as const) {
      await owner.profile.create({
        data: { id: pid, email: `${slug}@test.local`, passwordHash: 'x', name: slug },
      })
    }
    await owner.profile.create({
      data: { id: execId, email: `exec-${tag}@test.local`, passwordHash: 'x', name: 'Exec' },
    })
    agencyA = (
      await provisionAgency(owner, {
        name: `PR A ${tag}`,
        slug: `pr-a-${tag}`,
        ownerProfileId: ownerA,
      })
    ).agencyId
    agencyB = (
      await provisionAgency(owner, {
        name: `PR B ${tag}`,
        slug: `pr-b-${tag}`,
        ownerProfileId: ownerB,
      })
    ).agencyId
    companyA = (
      await owner.company.create({
        data: { agencyId: agencyA, name: 'CA', slug: `ca-${tag}` },
        select: { id: true },
      })
    ).id
    companyB = (
      await owner.company.create({
        data: { agencyId: agencyB, name: 'CB', slug: `cb-${tag}` },
        select: { id: true },
      })
    ).id
    projectB = (
      await owner.project.create({
        data: {
          agencyId: agencyB,
          companyId: companyB,
          name: 'B proj',
          billingModel: 'hourly_postpaid',
          clientHourlyRate: 30,
        },
        select: { id: true },
      })
    ).id
  })

  afterAll(async () => {
    if (owner) {
      await owner.projectExecutorRate.deleteMany({
        where: { agencyId: { in: [agencyA, agencyB] } },
      })
      await owner.project.deleteMany({ where: { agencyId: { in: [agencyA, agencyB] } } })
      await owner.legalEntity.deleteMany({ where: { agencyId: { in: [agencyA, agencyB] } } })
      await owner.company.deleteMany({ where: { agencyId: { in: [agencyA, agencyB] } } })
      await owner.agencyMember.deleteMany({ where: { agencyId: { in: [agencyA, agencyB] } } })
      await owner.agency.deleteMany({ where: { id: { in: [agencyA, agencyB] } } })
      await owner.profile.deleteMany({ where: { id: { in: [ownerA, ownerB, execId] } } })
    }
    if (app) await app.$disconnect()
    if (owner) await owner.$disconnect()
  })

  async function asTenant<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
    await app.$executeRawUnsafe(`SELECT set_config('app.current_agency_id', '${agencyId}', false)`)
    return fn()
  }

  it('RLS: a tenant cannot read the other tenant project (USING → null)', async () => {
    const row = await asTenant(agencyA, () => app.project.findUnique({ where: { id: projectB } }))
    expect(row).toBeNull()
  })

  it('RLS WITH CHECK: cannot INSERT a project stamped with another tenant', async () => {
    await expect(
      asTenant(agencyA, () =>
        app.project.create({
          data: {
            agencyId: agencyB,
            companyId: companyB,
            name: 'cross',
            billingModel: 'hourly_postpaid',
            clientHourlyRate: 10,
          },
        })
      )
    ).rejects.toThrow()
  })

  it('unique [companyId, name]: a duplicate project name for the same company is rejected', async () => {
    await owner.project.create({
      data: {
        agencyId: agencyA,
        companyId: companyA,
        name: 'Оренда',
        billingModel: 'fixed_monthly_advance',
        abonAmount: 100,
      },
    })
    await expect(
      owner.project.create({
        data: {
          agencyId: agencyA,
          companyId: companyA,
          name: 'Оренда',
          billingModel: 'hourly_prepaid',
          clientHourlyRate: 20,
        },
      })
    ).rejects.toThrow()
  })

  it('ProjectExecutorRate: unique [projectId, executorId] + tenant-isolated', async () => {
    const proj = await owner.project.create({
      data: {
        agencyId: agencyA,
        companyId: companyA,
        name: `rates-${tag}`,
        billingModel: 'hourly_prepaid',
        clientHourlyRate: 30,
      },
      select: { id: true },
    })
    await owner.projectExecutorRate.create({
      data: { agencyId: agencyA, projectId: proj.id, executorId: execId, costHourlyRate: 10 },
    })
    await expect(
      owner.projectExecutorRate.create({
        data: { agencyId: agencyA, projectId: proj.id, executorId: execId, costHourlyRate: 12 },
      })
    ).rejects.toThrow()
    // RLS: tenant B cannot see tenant A's rate
    const seen = await asTenant(agencyB, () =>
      app.projectExecutorRate.findMany({ where: { projectId: proj.id }, select: { id: true } })
    )
    expect(seen).toHaveLength(0)
  })

  it('legalEntity SET NULL: deleting an entity nulls the project link (Юр-3 fallback to default)', async () => {
    const le = await owner.legalEntity.create({
      data: { agencyId: agencyA, name: `LE-${tag}`, legalType: 'tov', legalName: 'ТОВ X' },
      select: { id: true },
    })
    const proj = await owner.project.create({
      data: {
        agencyId: agencyA,
        companyId: companyA,
        name: `le-link-${tag}`,
        billingModel: 'hourly_prepaid',
        clientHourlyRate: 30,
        legalEntityId: le.id,
      },
      select: { id: true },
    })
    await owner.legalEntity.delete({ where: { id: le.id } })
    const after = await owner.project.findUnique({
      where: { id: proj.id },
      select: { legalEntityId: true },
    })
    expect(after?.legalEntityId).toBeNull()
  })
})
