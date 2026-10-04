import type { PrismaClient } from '@workflo/db'

/**
 * R2 (аудит r6): нумерація документів — переїхала з routes/documents/documents.ts,
 * бо її споживають сервіс (autoInvoice) і cron (clientMonthlyReport) — cron→route
 * імпорт був інверсією шарів.
 */

const NUMBER_PREFIX: Record<string, string> = {
  invoice: 'INV',
  advance_invoice: 'ADV',
  completion_act: 'ACT',
  specification: 'SPC',
  reconciliation_act: 'REC',
  contract: 'CTR',
  monthly_report: 'RPT', // 19-Г: місячний звіт клієнту
}

/**
 * Race-safe per-agency document number (06, Аудит-фіналізація A). The counter row is
 * `(agencyId, type, year)`; `INSERT … ON CONFLICT … DO UPDATE count = count + 1 RETURNING`
 * is atomic, so two concurrent issues never collide on the same `INV-2026-000001`.
 */
export async function nextDocumentNumber(
  tx: Pick<PrismaClient, '$queryRaw'>,
  agencyId: string,
  type: string,
  year: number
): Promise<string> {
  const rows = await tx.$queryRaw<{ count: number }[]>`
    INSERT INTO document_counters ("agencyId", type, year, count)
    VALUES (${agencyId}, ${type}::"DocumentType", ${year}, 1)
    ON CONFLICT ("agencyId", type, year)
    DO UPDATE SET count = document_counters.count + 1
    RETURNING count
  `
  const count = Number(rows[0]?.count ?? 1)
  return `${NUMBER_PREFIX[type] ?? 'DOC'}-${year}-${String(count).padStart(6, '0')}`
}
