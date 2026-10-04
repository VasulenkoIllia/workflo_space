import type { Prisma } from '@workflo/db'

/**
 * Shared currency normalization to USD (the reporting base) for read-side aggregation
 * (P&L, margin). The single place the EUR/UAH FX legs live so pnl.ts and margin.ts can
 * never drift. Rates come from the agency's stored `ExchangeRate` row (NBU cron).
 *
 * USD → identity; UAH → ÷ usdToUah; EUR (P-8) → EUR→UAH→USD = × eurToUah ÷ usdToUah.
 * Unknown currency / missing rate → counted as-is (documented; a non-fatal best-effort
 * for reports, unlike the payment path which hard-stops on a missing rate).
 */
export interface FxRates {
  usdToUah: Prisma.Decimal | null
  eurToUah: Prisma.Decimal | null
}

export function toUsd(amount: Prisma.Decimal, currency: string, rates: FxRates): Prisma.Decimal {
  if (currency === 'USD') return amount
  if (currency === 'UAH' && rates.usdToUah && rates.usdToUah.greaterThan(0)) {
    return amount.div(rates.usdToUah)
  }
  if (
    currency === 'EUR' &&
    rates.eurToUah &&
    rates.eurToUah.greaterThan(0) &&
    rates.usdToUah &&
    rates.usdToUah.greaterThan(0)
  ) {
    return amount.times(rates.eurToUah).div(rates.usdToUah)
  }
  return amount // unknown currency / missing rate → counted as-is
}
