import { useState } from 'react'
import { toast } from 'sonner'
import { downloadCsv, downloadXlsx, type ExportTable } from '@/lib/exportTable'

/**
 * Пара кнопок «CSV · XLSX» для звітних сторінок (19-Б). `getTables` лінива —
 * таблиця(і) будується лише на клік; XLSX показує busy, поки динамічно
 * тягнеться exceljs і пишеться книга.
 */
export function ExportButtons({
  getTables,
  filename,
  disabled,
}: {
  getTables: () => ExportTable | ExportTable[]
  filename: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)

  const xlsx = async () => {
    setBusy(true)
    try {
      await downloadXlsx(getTables(), filename)
    } catch {
      toast.error('Не вдалося сформувати XLSX')
    } finally {
      setBusy(false)
    }
  }

  const linkStyle = { fontSize: 12 } as const
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        className="wfp-link wfp-mono"
        style={linkStyle}
        disabled={disabled}
        onClick={() => downloadCsv(getTables(), filename)}
      >
        CSV
      </button>
      <button
        type="button"
        className="wfp-link wfp-mono"
        style={linkStyle}
        disabled={disabled || busy}
        onClick={() => void xlsx()}
      >
        {busy ? 'XLSX…' : 'XLSX'}
      </button>
    </span>
  )
}
