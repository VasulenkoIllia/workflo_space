import { randomUUID } from 'node:crypto'
import { Prisma, prisma, runWithAgency, runWithSystemContext, tenantTransaction } from '@workflo/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * RLS-борг r4→r5 (закрито 10.07): tenant_isolation на agency_members проти РЕАЛЬНОГО PG.
 * Dev-конект `workflo` — superuser (bypassrls), тож ізоляцію доводимо як у проді при
 * RLS_ENFORCED: `SET LOCAL ROLE workflo_app` (обмежена роль з F4-міграції) всередині tx.
 * Інваріанти, через які борг відкладався:
 *  1. auth-hot-path: БЕЗ GUC (login/refresh/switch читають raw prisma) обмежена роль бачить
 *     ВСІ memberships профіля — логін не ламається (wf_in_tenant permissive при unset);
 *  2. з GUC агенції A memberships агенції B невидимі (ізоляція);
 *  3. WITH CHECK: створення membership агенції B під GUC=A блокується;
 *  4. фікс acceptInvite: під runWithAgency(агенція ІНВАЙТА) створення проходить;
 *  5. system-bypass бачить усе (workers/seed).
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

const asAppRole = (tx: Prisma.TransactionClient) =>
  tx.$executeRawUnsafe('SET LOCAL ROLE workflo_app')

run('agency_members RLS (real PG, роль workflo_app)', () => {
  const agencyA = randomUUID()
  const agencyB = randomUUID()
  const profileId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  beforeAll(async () => {
    await prisma.profile.create({
      data: { id: profileId, email: `rls-${tag}@test.local`, passwordHash: 'x', name: 'RLS Seed' },
    })
    await prisma.agency.create({
      data: { id: agencyA, name: `rls-a-${tag}`, slug: `rls-a-${tag}` },
    })
    await prisma.agency.create({
      data: { id: agencyB, name: `rls-b-${tag}`, slug: `rls-b-${tag}` },
    })
    await prisma.agencyMember.create({ data: { agencyId: agencyA, profileId, role: 'executor' } })
    await prisma.agencyMember.create({ data: { agencyId: agencyB, profileId, role: 'executor' } })
  })

  afterAll(async () => {
    await prisma.agencyMember.deleteMany({ where: { profileId } })
    await prisma.agency.deleteMany({ where: { id: { in: [agencyA, agencyB] } } })
    await prisma.profile.deleteMany({ where: { id: profileId } })
    await prisma.$disconnect()
  })

  it('auth-hot-path: без GUC обмежена роль бачить ВСІ memberships (логін живий)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await asAppRole(tx) // GUC НЕ виставлено — рівно як login/refresh/switch
      return tx.agencyMember.findMany({ where: { profileId }, select: { agencyId: true } })
    })
    expect(rows.map((r) => r.agencyId).sort()).toEqual([agencyA, agencyB].sort())
  })

  it('з GUC агенції A memberships агенції B невидимі', async () => {
    const rows = await runWithAgency(agencyA, () =>
      tenantTransaction(prisma, async (tx) => {
        await asAppRole(tx)
        return tx.agencyMember.findMany({ where: { profileId }, select: { agencyId: true } })
      })
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.agencyId).toBe(agencyA)
  })

  it('WITH CHECK: створення membership агенції B під GUC=A блокується', async () => {
    const stranger = randomUUID()
    await prisma.profile.create({
      data: { id: stranger, email: `rls2-${tag}@test.local`, passwordHash: 'x', name: 'X' },
    })
    try {
      await expect(
        runWithAgency(agencyA, () =>
          tenantTransaction(prisma, async (tx) => {
            await asAppRole(tx)
            return tx.agencyMember.create({
              data: { agencyId: agencyB, profileId: stranger, role: 'executor' },
            })
          })
        )
      ).rejects.toThrow(/row-level security|denies access/i)
    } finally {
      await prisma.agencyMember.deleteMany({ where: { profileId: stranger } })
      await prisma.profile.deleteMany({ where: { id: stranger } })
    }
  })

  it('фікс acceptInvite: під runWithAgency(агенція інвайта) створення проходить', async () => {
    const invited = randomUUID()
    await prisma.profile.create({
      data: { id: invited, email: `rls3-${tag}@test.local`, passwordHash: 'x', name: 'Y' },
    })
    try {
      // семантика acceptInvite: юзер «активний» в A, але інвайт у B → біндимо B
      const created = await runWithAgency(agencyB, () =>
        tenantTransaction(prisma, async (tx) => {
          await asAppRole(tx)
          return tx.agencyMember.create({
            data: { agencyId: agencyB, profileId: invited, role: 'executor' },
            select: { agencyId: true },
          })
        })
      )
      expect(created.agencyId).toBe(agencyB)
    } finally {
      await prisma.agencyMember.deleteMany({ where: { profileId: invited } })
      await prisma.profile.deleteMany({ where: { id: invited } })
    }
  })

  it('system-bypass бачить memberships усіх агенцій (workers/seed)', async () => {
    const rows = await runWithSystemContext(() =>
      tenantTransaction(prisma, async (tx) => {
        await asAppRole(tx)
        return tx.agencyMember.findMany({ where: { profileId }, select: { agencyId: true } })
      })
    )
    expect(rows).toHaveLength(2)
  })
})
