import { useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@workflo/ui'
import { API_URL, getAccessToken } from './api.js'

/**
 * S9-06 GDPR: вивантаження власних даних одним JSON-файлом (`GET /profile/export`).
 * COV-UX-6: спільна секція — портал мав її локально, workspace не мав узагалі.
 */
export function DataExportSection({ cardStyle }: { cardStyle?: CSSProperties }) {
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_URL}/profile/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) throw new Error('export failed')
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'workflo-my-data.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('Не вдалося сформувати експорт')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="Мої дані (GDPR)" style={cardStyle}>
      <p style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', margin: '0 0 12px' }}>
        Завантажте копію своїх персональних даних (профіль, налаштування, членства, ваші сповіщення
        й повідомлення) одним JSON-файлом. Секрети (паролі, дані сейфа) не включаються.
      </p>
      <Button variant="secondary" loading={busy} onClick={() => void download()}>
        Завантажити мої дані
      </Button>
    </Card>
  )
}
