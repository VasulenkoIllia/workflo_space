import { afterEach, describe, expect, it, vi } from 'vitest'

const agencyFindMany = vi.fn()
const exchangeRateUpsert = vi.fn()
const exchangeRateCount = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    agency: { findMany: agencyFindMany },
    exchangeRate: { upsert: exchangeRateUpsert, count: exchangeRateCount },
  },
}))

const { fetchNbuRates, syncExchangeRates, msUntilUtc } = await import('../src/cron/exchangeRate.js')

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Parameters<typeof syncExchangeRates>[0]

const okResp = (data: unknown): Response =>
  ({ ok: true, status: 200, json: () => Promise.resolve(data) }) as Response
const errResp = (status: number): Response =>
  ({ ok: false, status, json: () => Promise.resolve(null) }) as Response

const NBU_OK = [
  { cc: 'USD', rate: 41.5 },
  { cc: 'EUR', rate: 45.2 },
  { cc: 'PLN', rate: 10.1 },
]

describe('fetchNbuRates', () => {
  afterEach(() => vi.clearAllMocks())

  it('parses the NBU array into a currency→rate map', async () => {
    const rates = await fetchNbuRates(vi.fn().mockResolvedValue(okResp(NBU_OK)))
    expect(rates).toEqual({ USD: 41.5, EUR: 45.2, PLN: 10.1 })
  })

  it('throws on a non-OK response', async () => {
    await expect(fetchNbuRates(vi.fn().mockResolvedValue(errResp(503)))).rejects.toThrow(/503/)
  })

  it('throws on an unexpected (non-array) payload', async () => {
    await expect(fetchNbuRates(vi.fn().mockResolvedValue(okResp({ oops: true })))).rejects.toThrow(
      /array/
    )
  })

  it('skips malformed / non-positive rows', async () => {
    const rates = await fetchNbuRates(
      vi
        .fn()
        .mockResolvedValue(
          okResp([{ cc: 'USD', rate: 41.5 }, { cc: 'BAD' }, { cc: 'ZERO', rate: 0 }])
        )
    )
    expect(rates).toEqual({ USD: 41.5 })
  })
})

describe('syncExchangeRates', () => {
  afterEach(() => vi.clearAllMocks())

  it('upserts every active agency with the USD (+EUR) rate', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])
    exchangeRateUpsert.mockResolvedValue({})

    const res = await syncExchangeRates(logger, {
      fetchImpl: vi.fn().mockResolvedValue(okResp(NBU_OK)),
    })

    expect(res).toEqual({ updated: 2, failed: false, staleAgencies: 0 })
    expect(exchangeRateUpsert).toHaveBeenCalledTimes(2)
    expect(exchangeRateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId: 'a1' },
        create: expect.objectContaining({ usdToUah: 41.5, eurToUah: 45.2, updatedBy: 'nbu-cron' }),
      })
    )
  })

  it('keeps last rates (no throw) and flags stale agencies when the NBU fetch fails', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'a1' }])
    exchangeRateCount.mockResolvedValue(3)

    const res = await syncExchangeRates(logger, {
      fetchImpl: vi.fn().mockResolvedValue(errResp(500)),
    })

    expect(res).toEqual({ updated: 0, failed: true, staleAgencies: 3 })
    expect(exchangeRateUpsert).not.toHaveBeenCalled()
    expect(exchangeRateCount).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('keeps last rates when the payload has no USD', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'a1' }])
    exchangeRateCount.mockResolvedValue(0)

    const res = await syncExchangeRates(logger, {
      fetchImpl: vi.fn().mockResolvedValue(okResp([{ cc: 'EUR', rate: 45.2 }])),
    })

    expect(res.failed).toBe(true)
    expect(res.updated).toBe(0)
    expect(exchangeRateUpsert).not.toHaveBeenCalled()
  })

  it('does not overwrite a stored EUR when today’s payload lacks it', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'a1' }])
    exchangeRateUpsert.mockResolvedValue({})

    await syncExchangeRates(logger, {
      fetchImpl: vi.fn().mockResolvedValue(okResp([{ cc: 'USD', rate: 41.5 }])),
    })

    const call = exchangeRateUpsert.mock.calls[0][0]
    expect(call.update).not.toHaveProperty('eurToUah')
    expect(call.create.eurToUah).toBeNull()
  })
})

describe('msUntilUtc', () => {
  it('returns ms until the next HH:MM today when it is still ahead', () => {
    const now = new Date('2026-06-08T05:00:00.000Z')
    expect(msUntilUtc(6, 10, now)).toBe(70 * 60 * 1000) // 1h10m
  })

  it('rolls over to tomorrow when the time already passed today', () => {
    const now = new Date('2026-06-08T07:00:00.000Z')
    expect(msUntilUtc(6, 10, now)).toBe((23 * 60 + 10) * 60 * 1000) // 23h10m
  })
})
