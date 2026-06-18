import { randomUUID } from 'node:crypto'
import { prisma, tenantTransaction } from '@workflo/db'
import type { UpdateClientRequisitesInput } from '@workflo/types'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyClientRequisites } from '../../src/services/clientRequisites.js'

/**
 * Client legal requisites (S5.6 P-3, 06-Б) against REAL Postgres. Proves legalIsComplete
 * recompute from the MERGED result (omit keeps, null clears), and the cross-tenant 404.
 * Gated on RUN_DB_TESTS=1.
 */
const ENABLED = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL
const run = ENABLED ? describe : describe.skip

run('client requisites (real PG)', () => {
  const agencyId = randomUUID()
  const companyId = randomUUID()
  const tag = randomUUID().slice(0, 8)

  const FULL: UpdateClientRequisitesInput = {
    legalType: 'tov',
    legalName: 'ТОВ Acme',
    taxId: '12345678',
    iban: 'UA213223130000026007233566001',
    signerName: 'Іваненко І.І.',
    documentEmail: 'docs@acme.test',
  }

  function apply(input: UpdateClientRequisitesInput, agency = agencyId) {
    return tenantTransaction(prisma, (tx) =>
      applyClientRequisites(tx, { agencyId: agency, companyId, input })
    )
  }

  beforeAll(async () => {
    await prisma.agency.create({ data: { id: agencyId, name: `cr-${tag}`, slug: `cr-${tag}` } })
    await prisma.company.create({
      data: { id: companyId, agencyId, name: 'CR Co', slug: `cr-${tag}` },
    })
  })

  afterEach(async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        legalType: null,
        legalName: null,
        taxId: null,
        vatId: null,
        legalAddress: null,
        bankName: null,
        iban: null,
        signerName: null,
        signerTitle: null,
        vatPayer: false,
        documentEmail: null,
        documentEmailCc: null,
        legalIsComplete: false,
      },
    })
  })

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.agency.deleteMany({ where: { id: agencyId } })
    await prisma.$disconnect()
  })

  it('all required fields present → legalIsComplete true + stored', async () => {
    const r = await apply(FULL)
    expect(r.legalIsComplete).toBe(true)
    expect(r.legalName).toBe('ТОВ Acme')
    expect(r.documentEmail).toBe('docs@acme.test')
  })

  it('partial (one required field) → legalIsComplete false', async () => {
    const r = await apply({ legalName: 'ТОВ Acme' })
    expect(r.legalIsComplete).toBe(false)
  })

  it('merge: a later unrelated patch keeps the gate fields (stays complete)', async () => {
    await apply(FULL)
    const r = await apply({ vatPayer: true }) // does not touch gate fields
    expect(r.vatPayer).toBe(true)
    expect(r.legalIsComplete).toBe(true) // omitted gate fields kept → still complete
  })

  it('clearing a required field (explicit null) drops legalIsComplete', async () => {
    await apply(FULL)
    const r = await apply({ taxId: null })
    expect(r.taxId).toBeNull()
    expect(r.legalIsComplete).toBe(false)
  })

  it('404 for a company in another tenant', async () => {
    await expect(apply({ legalName: 'X' }, randomUUID())).rejects.toThrow(/не знайдено/)
  })
})
