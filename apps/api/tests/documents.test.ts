import { describe, expect, it, vi } from 'vitest'

vi.mock('@workflo/db', () => ({
  prisma: {},
  tenantTransaction: vi.fn(),
  withTenant: vi.fn(),
}))

const { nextDocumentNumber } = await import('../src/routes/documents/documents.js')

type Tx = Parameters<typeof nextDocumentNumber>[0]
const txWithCount = (count: number): Tx =>
  ({ $queryRaw: vi.fn().mockResolvedValue([{ count }]) }) as unknown as Tx

describe('document numbering (per-agency, race-safe)', () => {
  it('formats as PREFIX-YEAR-padded6 (first issue)', async () => {
    expect(await nextDocumentNumber(txWithCount(1), 'a1', 'invoice', 2026)).toBe('INV-2026-000001')
  })

  it('prefixes by type + pads the running count', async () => {
    expect(await nextDocumentNumber(txWithCount(42), 'a1', 'completion_act', 2026)).toBe(
      'ACT-2026-000042'
    )
    expect(await nextDocumentNumber(txWithCount(7), 'a1', 'specification', 2026)).toBe(
      'SPC-2026-000007'
    )
  })

  it('falls back to DOC prefix for an unknown type', async () => {
    expect(await nextDocumentNumber(txWithCount(3), 'a1', 'mystery', 2026)).toBe('DOC-2026-000003')
  })
})
