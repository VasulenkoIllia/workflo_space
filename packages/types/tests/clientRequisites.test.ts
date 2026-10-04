import { describe, expect, it } from 'vitest'
import { clientRequisitesIsComplete } from '../src/schemas/clientRequisites.schema.js'

/**
 * Client document-readiness gate (P-3, Юр-2 analog): complete iff legalName + taxId +
 * iban + signerName are all non-empty. Pure — no DB.
 */
describe('clientRequisitesIsComplete', () => {
  const full = { legalName: 'ТОВ Acme', taxId: '12345678', iban: 'UA00...', signerName: 'Іваненко' }

  it('true when all four required fields are present', () => {
    expect(clientRequisitesIsComplete(full)).toBe(true)
  })

  it('false when any required field is missing', () => {
    expect(clientRequisitesIsComplete({ ...full, taxId: null })).toBe(false)
    expect(clientRequisitesIsComplete({ ...full, iban: undefined })).toBe(false)
    expect(clientRequisitesIsComplete({ legalName: 'ТОВ Acme' })).toBe(false)
  })

  it('false when a required field is whitespace-only', () => {
    expect(clientRequisitesIsComplete({ ...full, signerName: '   ' })).toBe(false)
  })

  it('ignores non-gate fields (vatId, address) for completeness', () => {
    expect(clientRequisitesIsComplete(full)).toBe(true) // no vatId/address needed
  })
})
