import { describe, expect, it } from 'vitest'
import {
  createLegalEntitySchema,
  legalEntityIsComplete,
  updateLegalEntitySchema,
} from '../src/schemas/legalEntity.schema.js'

/** Юр-2 document-gate logic + create/update validation (LEGAL_ENTITY_SPEC, P-1б). */

describe('legalEntityIsComplete', () => {
  const full = {
    legalName: 'ТОВ Workflo',
    taxId: '12345678',
    iban: 'UA12...',
    signerName: 'Іваненко',
  }

  it('true only when all four required fields are non-empty', () => {
    expect(legalEntityIsComplete(full)).toBe(true)
  })

  it('false when any required field is missing or blank', () => {
    expect(legalEntityIsComplete({ ...full, taxId: null })).toBe(false)
    expect(legalEntityIsComplete({ ...full, iban: undefined })).toBe(false)
    expect(legalEntityIsComplete({ ...full, signerName: '   ' })).toBe(false)
    expect(legalEntityIsComplete({ ...full, legalName: '' })).toBe(false)
  })

  it('a freshly provisioned default entity (name only) is incomplete', () => {
    expect(legalEntityIsComplete({ legalName: 'Acme' })).toBe(false)
  })
})

describe('createLegalEntitySchema', () => {
  it('accepts the minimum (name, legalType, legalName) and defaults vatPayer', () => {
    const parsed = createLegalEntitySchema.parse({
      name: 'ФОП',
      legalType: 'fop',
      legalName: 'ФОП Іваненко',
    })
    expect(parsed.vatPayer).toBe(false)
  })

  it('rejects a missing required field', () => {
    expect(() => createLegalEntitySchema.parse({ name: 'ФОП', legalType: 'fop' })).toThrow()
  })
})

describe('updateLegalEntitySchema', () => {
  it('rejects an empty patch', () => {
    expect(() => updateLegalEntitySchema.parse({})).toThrow()
  })

  it('rejects unknown fields (strict) — e.g. isDefault is a separate route', () => {
    expect(() => updateLegalEntitySchema.parse({ isDefault: true })).toThrow()
  })

  it('allows nulling an optional field', () => {
    expect(updateLegalEntitySchema.parse({ taxId: null }).taxId).toBeNull()
  })
})
