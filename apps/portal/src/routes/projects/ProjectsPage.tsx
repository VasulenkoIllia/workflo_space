import { Card, EmptyState, Skeleton, StatusDot } from '@workflo/ui'
import { type ClientProject, usePortalProjects } from '@/lib/projects'

const MODEL_LABEL: Record<string, string> = {
  fixed_monthly_advance: 'Абонплата (аванс)',
  hourly_prepaid: 'Погодинно (аванс)',
  hourly_postpaid: 'Погодинно (факт)',
}
const CYCLE_LABEL: Record<string, string> = {
  monthly_day_n: 'Щомісяця',
  weekly_day_x: 'Щотижня',
  manual: 'Вручну',
}

function priceLabel(p: ClientProject): string {
  if (p.billingModel === 'fixed_monthly_advance') {
    return p.abonAmount ? `${Number(p.abonAmount)} ${p.currency}/міс` : '—'
  }
  return p.clientHourlyRate ? `${Number(p.clientHourlyRate)} ${p.currency}/год` : '—'
}

/** Portal «Проєкти» (#6) — the client's own financial projects, read-only (billing terms). */
export function ProjectsPage() {
  const { data, isLoading } = usePortalProjects()
  const projects = data?.projects ?? []

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <div className="wfp-ph-sub">// ваші проєкти · умови співпраці</div>
          <h1 className="wfp-ph-h1">Проєкти</h1>
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 240 }} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Проєктів ще немає"
          description="Коли агенція налаштує фінансовий проєкт для вашої компанії, він зʼявиться тут."
        />
      ) : (
        <Card title={`Проєкти · ${projects.length}`}>
          <table className="wfp-table">
            <thead>
              <tr>
                <th>Проєкт</th>
                <th>Модель</th>
                <th>Цикл</th>
                <th className="wfp-num">Ставка</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.includedHoursCap && (
                      <div
                        className="wfp-mono"
                        style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}
                      >
                        включено {Number(p.includedHoursCap)} год
                      </div>
                    )}
                  </td>
                  <td className="wfp-mono" style={{ fontSize: 12 }}>
                    {MODEL_LABEL[p.billingModel] ?? p.billingModel}
                  </td>
                  <td className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
                    {CYCLE_LABEL[p.billingCycle] ?? p.billingCycle}
                  </td>
                  <td className="wfp-num">{priceLabel(p)}</td>
                  <td>
                    <span className="wfp-order-status">
                      <StatusDot tone={p.active ? 'success' : 'neutral'} />
                      {p.active ? 'активний' : 'неактивний'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
