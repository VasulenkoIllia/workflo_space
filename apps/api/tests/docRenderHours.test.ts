import { describe, expect, it, vi } from 'vitest'

// ПРИЙМАННЯ→АКТ: акт погодинного разового замовлення друкує рядок з БІЛАБЕЛЬНИМИ годинами.
vi.mock('@workflo/db', () => ({ prisma: {}, Prisma: {} }))

const { buildRenderData } = await import('../src/services/documentRender.js')

function makeTx(orderOverrides: Record<string, unknown>) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue({
        nomenclature: null,
        project: null,
        ...orderOverrides,
      }),
    },
    document: { findFirst: vi.fn().mockResolvedValue(null) },
    documentTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
  }
}

function makeDoc(currency = 'UAH', totalAmount: unknown = '200.00') {
  return {
    type: 'completion_act',
    number: 'ACT-1',
    generatedAt: new Date('2026-07-07T00:00:00Z'),
    companyId: 'co-1',
    agencyId: 'ag-1',
    agency: { name: 'Agency' },
    order: {
      id: 'o1',
      title: 'Робота над проєктом',
      description: null,
      totalAmount,
      approvedAmount: null,
      currency,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      project: null,
    },
    company: { name: 'Client', legalName: null, taxId: null, legalAddress: null },
    legalEntity: null,
  }
}

describe('buildRenderData — акт погодинного замовлення (ПРИЙМАННЯ)', () => {
  it('hourly + billableHours → рядок «год × ставка», а не «послуга»', async () => {
    const tx = makeTx({ billingType: 'hourly', hourlyRate: '40.00', billableHours: '5.00' })
    const data = await buildRenderData(tx as never, makeDoc() as never)
    expect(data.lines).toEqual([
      { name: 'Робота над проєктом', qty: '5,00', unit: 'год', price: '40,00', sum: '200,00' },
    ])
  })

  it('нема billableHours (не прийнято) → рядок не будуємо (фолбек рендерера)', async () => {
    const tx = makeTx({ billingType: 'hourly', hourlyRate: '40.00', billableHours: null })
    const data = await buildRenderData(tx as never, makeDoc() as never)
    expect(data.lines).toBeUndefined()
  })

  it('номенклатура має пріоритет над погодинним рядком', async () => {
    const tx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          billingType: 'hourly',
          hourlyRate: '40.00',
          billableHours: '5.00',
          nomenclature: { name: 'Послуги розробки ПЗ' },
          project: null,
        }),
      },
      document: { findFirst: vi.fn().mockResolvedValue(null) },
      documentTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    const data = await buildRenderData(tx as never, makeDoc() as never)
    expect(data.lines).toEqual([
      { name: 'Послуги розробки ПЗ', qty: '1', unit: 'послуга', price: '200,00', sum: '200,00' },
    ])
  })
})
