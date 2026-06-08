import { Card, EmptyState } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_LABEL: Record<string, string> = {
  owner: 'власник',
  executor: 'виконавець',
  client: 'клієнт',
}

/** Executor profile + earnings. Rate/payout figures arrive with the finance module (S5). */
export function ProfilePage() {
  const { user } = useAuth()
  const p = user?.profile

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Профіль</h1>
          <div className="wfp-ph-sub">// особистий кабінет виконавця</div>
        </div>
      </div>

      <Card title="Обліковий запис" style={{ marginBottom: 16 }}>
        <div className="wfp-side">
          <div className="wfp-side-row">
            <div className="wfp-side-k">імʼя</div>
            <div className="wfp-side-v">{p?.displayName ?? '—'}</div>
          </div>
          <div className="wfp-side-row">
            <div className="wfp-side-k">email</div>
            <div className="wfp-side-v">{p?.email ?? '—'}</div>
          </div>
          <div className="wfp-side-row">
            <div className="wfp-side-k">роль</div>
            <div className="wfp-side-v">{ROLE_LABEL[p?.role ?? ''] ?? p?.role ?? '—'}</div>
          </div>
        </div>
      </Card>

      <Card title="Заробіток">
        <EmptyState
          title="Заробіток — скоро"
          description="Ставки, залоговані години та виплати зʼявляться разом із фінансовим модулем (S5)."
        />
      </Card>
    </div>
  )
}
