/**
 * Спільний експорт звітних таблиць у CSV та XLSX (19-Б «експорт на кожному звіті»).
 *
 * Модель — масив таблиць: CSV зшиває їх порожнім рядком (як hours-звіт),
 * XLSX кладе кожну на ОКРЕМИЙ аркуш. Числа лишаються числами (у XLSX —
 * справжні numeric-клітинки), рядки CSV екрануються лапками.
 *
 * exceljs (~250KB gzip) підвантажується динамічно лише на клік по XLSX —
 * основний бандл не росте.
 */
export type TableCell = string | number | null

export interface ExportTable {
  /** Назва аркуша в Excel (обрізається до 31 символа — ліміт формату). */
  sheet: string
  headers: string[]
  rows: TableCell[][]
}

function trigger(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function csvCell(c: TableCell): string {
  if (c == null) return ''
  if (typeof c === 'number') return String(c)
  return `"${c.replace(/"/g, '""')}"`
}

export function downloadCsv(tables: ExportTable | ExportTable[], filename: string): void {
  const list = Array.isArray(tables) ? tables : [tables]
  const parts = list.map((t) =>
    [t.headers.join(','), ...t.rows.map((r) => r.map(csvCell).join(','))].join('\n')
  )
  trigger(new Blob([parts.join('\n\n')], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
}

export async function downloadXlsx(
  tables: ExportTable | ExportTable[],
  filename: string
): Promise<void> {
  const list = Array.isArray(tables) ? tables : [tables]
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  for (const t of list) {
    const ws = wb.addWorksheet(t.sheet.slice(0, 31) || 'Аркуш')
    ws.addRow(t.headers)
    ws.getRow(1).font = { bold: true }
    for (const r of t.rows) ws.addRow(r.map((c) => c ?? ''))
    // Ширина колонки ≈ найдовший вміст (візуальний мінімум 10, стеля 40).
    t.headers.forEach((h, i) => {
      const longest = Math.max(h.length, ...t.rows.map((r) => String(r[i] ?? '').length))
      ws.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 40)
    })
  }
  const buf = await wb.xlsx.writeBuffer()
  trigger(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filename}.xlsx`
  )
}
